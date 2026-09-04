/**
 * **What a run SAID, on the screen, in the browser the owner opens.**
 *
 * ── THE REPORT ─────────────────────────────────────────────────────────────
 *
 * Owner, 2026-09-03: *"in warning there is `mycontext ack
 * REF-v2-handover-read-before-discussing-the-web-ui dead_scope`, clicked
 * execute, clicked run it but nothing has changed"*.
 *
 * Nothing had. That finding was acknowledged at 00:17, so the 07:29 run re-ran
 * `ack` against a ruling that was already current and the CLI answered — on
 * `stdout`, 200, exit 0 — *"my_context: REF-… already acknowledges "dead_scope"
 * against its current content. Nothing was written."* (`src/core/mutate.ts`, the
 * `before === 'current'` return).
 *
 * `lib/command-actions.js`'s `report()` then appended exactly one node: a green
 * `<span class="exitcode">exit code 0</span>`. The word `stdout` appeared
 * NOWHERE in that file. So the product did the right thing, said so in a
 * complete sentence, and the client threw the sentence away and reported
 * success.
 *
 * ── WHY THIS SPEC EXISTS BESIDE `doctor-outcome.spec.ts` ───────────────────
 *
 * That file asks WHERE the outcome landed and holds it inside the viewport —
 * written after the same morning's report, over a node whose entire content was
 * `exit 0`. Every one of its assertions is satisfied by an outcome region that
 * says nothing: `toContainText('exit 0')` passes on a region that discarded the
 * answer, and did.
 *
 * This one asks WHAT THE REGION SAYS. The two questions are independent and the
 * second one has no test anywhere: `test/ui/command-actions.test.ts` drives a
 * fake DOM, which can prove a node was built and can prove nothing about a
 * person being able to read it.
 *
 * ── AND WHY IT NO LONGER DRIVES THE LIVE CORPUS ────────────────────────────
 *
 * It used to. `REQ-the-web-ui-is-dogfooded-against-this-corpus-and-the-e2e`, in
 * the owner's own words: *"this repository's own corpus … is what it displays
 * and manipulates. Not a fixture, not a seeded demo workspace."* That held for
 * exactly as long as the live corpus carried a finding this spec could rule on
 * WITHOUT writing to it — an already-acknowledged `acknowledge`-routed finding,
 * so that the one command this file runs (`ack`, re-run against a current
 * ruling) hits `mutate.ts`'s `before === 'current'` return and persists
 * nothing. Doctor went from 95 findings to zero the same week, on the strength
 * of the very settling features this suite exercises, and the corpus this spec
 * needs is gone with them — the same fact `doctor-settle.spec.ts` records at
 * length for its own control.
 *
 * **The owner's exception, given for that file and extended here for the
 * identical reason:** *"Each spec builds its own temp workspace with ONE
 * deliberate finding, exercises settlement on screen, and throws it away. The
 * live corpus is never touched."* This spec's control is the PER-ROW
 * `mycontext ack`, which `screens/doctor.js` draws for a single finding
 * regardless of count — unlike `doctor-settle.spec.ts`'s bulk control, which
 * needs two findings of one code before it draws at all — so one deliberate
 * finding is exactly what this spec's own control requires, matching the
 * owner's words without stretching them.
 *
 * `./doctor-workspace.ts` holds the scaffolding this file shares with
 * `doctor-settle.spec.ts`: spawn the CLI, `mkdtemp` and `init` a workspace, seed
 * one rule whose body retracts its own premise. What is NOT shared is how each
 * file finishes building its workspace, because the two need different states —
 * `doctor-settle.spec.ts` needs two OPEN findings and never acknowledges either;
 * this file needs one finding ALREADY ruled on, so `makeAckedWorkspace` below
 * runs `mycontext ack` once, for real, through the CLI, before the server ever
 * starts. That is the one write this file makes, and it lands in the throwaway
 * workspace's own item file — never in `.my_context/`.
 *
 * ── WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT ────────────────────────
 *
 * The workspace is built fresh per run, so it asserts SHAPES and one sentence
 * the CLI guarantees for the precondition it establishes, rather than an id or
 * a code pinned to this corpus's current content.
 */
import { rmSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import {
  initWorkspace, runCli, seedRetractingRule, RETRACTING_CODE,
} from './doctor-workspace.ts';

const DOCTOR = '[data-p="doctor"]';

/**
 * `mkdtemp`'d, `init`'d, seeded with ONE rule whose body retracts its own
 * premise, `ack`'d once for real through the CLI, `rebuild`'t, and handed back
 * as a bare path.
 *
 * **The `ack` here is the precondition, not the thing under test.** It puts
 * the workspace in the exact state the owner's report started from — a
 * finding a person has already ruled on — so that the run THIS SPEC drives
 * through the browser is a re-acknowledgement, which `mutate.ts` answers
 * without writing anything. That is checked below as an assertion (`exit 0`
 * and the composed sentence), not assumed from this function having run.
 *
 * **`rebuild` after `ack` is not redundant belt-and-suspenders left over from
 * copying `doctor-settle.spec.ts`.** `/api/doctor` is served through
 * `withStores`, which opens the SQLite-backed index as it stands rather than
 * rebuilding it — `doctor-settle.spec.ts`'s own comment carries the same
 * argument for the same reason. `ack`'s own write path rebuilds and closes its
 * store, which behind an ordinary filesystem is already enough; the explicit
 * `rebuild` here removes any dependence on exactly when SQLite's WAL is
 * checkpointed back into the database file, matching the one other file that
 * starts a UI server over a workspace this command just wrote to.
 */
function makeAckedWorkspace(): string {
  const root = initWorkspace('myctx-e2e-execute-output-');
  const id = seedRetractingRule(root, 'Already-ruled probe rule');
  runCli(root, ['ack', id, RETRACTING_CODE]);
  runCli(root, ['rebuild']);
  return root;
}

test('a run shows what the command SAID, not only that it exited', async ({ page }) => {
  test.setTimeout(120_000);

  let harness: UiHarness | undefined;
  let root: string | undefined;
  try {
    root = makeAckedWorkspace();
    harness = await startUiChild(root);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(
      page.locator('.nav').first(),
      'the server never rendered a rail button — it probably has no token; check that the '
      + 'one-shot nonce was not spent before the browser saw it',
    ).toBeVisible({ timeout: 30_000 });

    // Doctor is LOADED, not clicked. `app.js`'s route race — a hash change
    // starting a second route while the boot route is still rendering, with no
    // generation guard, so whichever screen finishes last wins the slot — is
    // real, is reported separately, and is not this file's subject.
    // `doctor-outcome.spec.ts` carries the measurement and routes around it the
    // same way; a person reaching this screen from a bookmark takes this path.
    await page.goto(`http://127.0.0.1:${h.port}/#/doctor`);
    await page.reload();
    await expect(
      page.locator(`${DOCTOR} td .cmdactions`).first(),
      'the Doctor screen drew no row-scoped control at all — `makeAckedWorkspace` seeds exactly '
      + 'one finding whose remedy is `acknowledge`, so this means the seeding itself failed '
      + 'rather than that the corpus happened to have nothing to offer',
    ).toBeVisible({ timeout: 60_000 });

    // ── THE TARGET: a finding SOMEBODY HAS ALREADY RULED ON, whose command
    // names exactly one row.
    //
    // Already-acknowledged is the whole of what makes the run below a no-op:
    // `mutate.ts` returns before it persists when the ruling is current, so
    // this run writes no item. It is also the exact state the owner was in,
    // which is why his press could only ever answer "nothing was written".
    //
    // Read off the served screen rather than assumed from `makeAckedWorkspace`
    // having run: the workspace is built to hold exactly one settleable row,
    // but the assertion below is what actually proves it drew as one — the
    // same precondition-checked-not-assumed shape `doctor-outcome.spec.ts`
    // uses for its own three preconditions.
    const settleable = await page.locator(`${DOCTOR} tbody tr`).evaluateAll((rows) => rows
      .map((tr) => ({
        key: tr.querySelector('td .cmdactions')?.getAttribute('data-cmdkey') ?? null,
        ruled: tr.querySelector('span.chip.index') !== null,
      }))
      .filter((r): r is { key: string; ruled: boolean } => r.key !== null));
    const tally = new Map<string, number>();
    for (const r of settleable) tally.set(r.key, (tally.get(r.key) ?? 0) + 1);
    const ruled = settleable.filter((r) => r.ruled && tally.get(r.key) === 1);
    expect(
      ruled.length,
      'this throwaway workspace holds no finding a person has already acknowledged AND whose '
      + '`ack` line names one row — `makeAckedWorkspace` (./doctor-workspace.ts) is supposed to '
      + 'seed exactly that, so this means the seeding failed rather than that a real corpus ran '
      + 'dry.',
    ).toBeGreaterThan(0);
    const command = ruled[ruled.length - 1]!.key;
    expect(command, 'the chosen row does not compose an ack').toMatch(/^mycontext ack /);

    const row = page.locator(`${DOCTOR} tbody tr`)
      .filter({ has: page.locator(`td .cmdactions[data-cmdkey="${command}"]`) });
    await expect(
      row,
      'the key chosen precisely because it named one row named a different number of them',
    ).toHaveCount(1);
    await row.scrollIntoViewIfNeeded();

    // ── 1. BEFORE THE PRESS, THE ROW SAYS IT IS ALREADY SETTLED. ──
    //
    // The defect the owner met was not only a discarded answer. The row offered
    // a button that could not do anything and carried nothing beside it saying
    // so, so he spent an Execute, a confirm and a full-corpus dry run finding
    // out. Read from the RENDERED text and required to sit BEFORE the command
    // in document order — a caveat a reader meets after pressing is not a
    // caveat.
    //
    // Neither of the owner's two open questions is asserted here, because
    // neither is settled: whether an acknowledged row should offer `ack --clear`
    // instead, and what an acknowledged row should look like. This holds only
    // that the row does not lie.
    const order = await row.evaluate((tr) => {
      const cell = tr.querySelector('td:last-child')!;
      const nodes = [...cell.querySelectorAll('p.small, div.cmd')];
      return nodes.map((n) => ({
        kind: n.className, text: (n.textContent ?? '').trim(),
      }));
    });
    const caveatAt = order.findIndex((n) => n.kind.includes('small') && n.text !== '');
    const commandAt = order.findIndex((n) => n.kind.includes('cmd'));
    expect(
      caveatAt,
      'an already-ruled-on row offers `mycontext ack` and says nothing about what that will do. '
      + `The cell holds: ${JSON.stringify(order)}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      caveatAt,
      'the caveat is drawn after the command it is about — a reader who has already pressed does '
      + 'not need it',
    ).toBeLessThan(commandAt);
    expect(
      order[caveatAt]!.text,
      'the sentence above the command no longer says that running it writes nothing',
    ).toMatch(/writes nothing/);

    // ── THE RUN — the owner's own two clicks. ──
    const actions = row.locator('td .cmdactions');
    await actions.getByRole('button', { name: 'Execute', exact: true }).click();
    const confirm = actions.locator('div.confirm');
    await confirm.waitFor({ state: 'visible', timeout: 60_000 });
    await expect(
      confirm.locator('div.cmd code'),
      'the confirm must show the exact argv this row is about to run',
    ).toHaveText(command);
    await confirm.getByRole('button', { name: 'Run it', exact: true }).click();

    const outcome = page.locator(`${DOCTOR} .execresult`).filter({ hasText: /exit \d/ });
    await expect(
      outcome,
      'the run reported no exit code at all',
    ).toHaveCount(1, { timeout: 60_000 });
    await expect(
      outcome,
      're-acknowledging a current ruling is a no-op the CLI returns cleanly from; a non-zero '
      + 'exit here is a refusal worth reading rather than a flake',
    ).toContainText('exit 0');

    // ── 2. THE ANSWER IS ON THE SCREEN. THIS IS THE DEFECT. ──
    //
    // The sentence is the CLI's, not this test's: `mutate.ts` returns exactly
    // *"my_context: <id> already acknowledges "<code>" against its current
    // content. Nothing was written."* for the state established as a
    // precondition above. So this is a guaranteed value over an asserted
    // precondition, not a value copied out of a corpus that moves.
    const said = outcome.locator('pre.lit');
    await expect(
      said,
      'the command output is not drawn at all. This is the owner\'s 2026-09-03 report: the run '
      + 'answered "already acknowledges … Nothing was written" and the page showed a green exit '
      + 'code over it.',
    ).toHaveCount(1);
    await expect(
      said,
      'the output region is drawn and holds none of what the command actually said',
    ).toContainText('Nothing was written');
    await expect(said, 'the CLI\'s own voice, unedited').toContainText('my_context:');

    // ── 3. AND A PERSON CAN READ IT — a box, never a node. ──
    //
    // `doctor-outcome.spec.ts` records why this is measured against the window:
    // the outcome node existed throughout that defect at `top: -146,513px`, and
    // three assertions elsewhere were green over it. A rendered sentence nobody
    // can see is the same failure with more text in it.
    const box = await said.evaluate((node) => {
      const r = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom),
        width: Math.round(r.width), height: Math.round(r.height),
        windowHeight: window.innerHeight, windowWidth: window.innerWidth,
        whiteSpace: style.whiteSpace,
      };
    });
    expect(
      box.height,
      `the output block has no height at all: ${JSON.stringify(box)}`,
    ).toBeGreaterThan(0);
    expect(
      box.top,
      `the output is above the top of the window: ${JSON.stringify(box)}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      box.top,
      `the output is below the bottom of the window: ${JSON.stringify(box)}`,
    ).toBeLessThan(box.windowHeight);
    // **It fits ACROSS, and that is not free.** `.pane` is `overflow:hidden`, so
    // a block that keeps whitespace and refuses to wrap is clipped rather than
    // scrollable — and `ack`'s answer is 145 columns wide. `pre-wrap` is what
    // keeps every byte and wraps anyway; asserted through the computed style so
    // that losing it is a failure here rather than a report from the owner.
    expect(
      box.whiteSpace,
      'the output block no longer preserves whitespace while wrapping, so a wide line is either '
      + 'collapsed into prose or clipped by `.pane{overflow:hidden}`',
    ).toBe('pre-wrap');
    expect(
      box.width,
      `the output is wider than the window, and .pane clips: ${JSON.stringify(box)}`,
    ).toBeLessThanOrEqual(box.windowWidth);
  } finally {
    if (harness !== undefined) await harness.stop();
    // Best-effort, and deliberately not awaited into a failure: a Windows
    // SQLite handle can outlive the child's own `exit` event by a beat, and a
    // failed cleanup of a disposable temp directory is not a reason to fail an
    // assertion that already passed — `doctor-settle.spec.ts` and
    // `doctor-outcome.spec.ts` carry the identical argument.
    if (root !== undefined) {
      try { rmSync(root, { recursive: true, force: true }); } catch { /* see above */ }
    }
  }
});
