/**
 * **Absent is not stale, stale is not zero — and the read surface's OWN single
 * write is what puts the served corpus into the stale state.**
 *
 * The owner's ruling on
 * `TASK-point-the-e2e-suite-at-the-served-corpus-not-only-at-the` names four
 * shapes a browser test over real data has to hold, and this file is the
 * fourth: *"a 503 that renders as the stale state rather than as zeroes"*. The
 * same task names the trap that makes it reachable at all:
 *
 *   *"the 401 is the read surface's one write, and it leaves the projection
 *   behind its log, so an authorised read after a refusal returns 503. Any
 *   sequence that refuses and then reads must expect that."*
 *
 * Verified 2026-08-26 and still true when this file was written: **no
 * absent-versus-stale assertion existed under the app fixture at all.**
 * `e2e/screen-parity.spec.ts` narrates the hazard in a comment and asserts
 * nothing about it. `e2e/watch-feed.spec.ts` does assert both states and
 * asserts them well — but over a five-record corpus it builds itself, with the
 * behind-ness produced by a synthetic `recordAudit` append. Two things are
 * therefore untested, and this file is those two:
 *
 *  1. **That a REFUSAL produces the state.** Nothing appends here. The test
 *     makes one unauthenticated request — the thing a bookmark, a stale cookie
 *     or a second browser tab does — and the server's own refusal record is
 *     what moves the log past the projection. That is not a fixture
 *     manoeuvre; it is the product's documented behaviour, and every screen
 *     reading the projection is one refusal away from it.
 *  2. **That it holds over the SERVED CORPUS**, at the size and shape the
 *     other specs measure. A refusal drawn correctly over five records says
 *     nothing about a screen with 900-odd of them to lose.
 *
 * ── WHY AN ISOLATED COPY AND NOT `.demo-corpus` ITSELF ─────────────────────
 *
 * Because this test PUTS A CORPUS INTO REFUSAL, and `.demo-corpus` is shared
 * by every other spec in the run. `e2e/simulate-slider.spec.ts` carries this
 * project's account of what a spec that writes shared state costs; the
 * disposable `mkdtemp` copy is `e2e/execute.spec.ts`'s answer to the same
 * hazard and this file follows it.
 *
 * **The copy filter is this file's own and is deliberately not `worthCopying`.**
 * That function drops all of `.audit`, which is exactly what is under test
 * here — a projection and a log, and the relationship between them. What must
 * still be dropped is every SQLite file: `.index.db` and `.audit/audit.db` are
 * both held open by whichever server is up, and on Windows that is a mandatory
 * lock, so copying one fails with `EDOM` (the owner's own report, 2026-08-27).
 * Both are DERIVED — the markdown is the corpus
 * (`INV-markdown-is-the-source-of-truth`) and the projection is a fold of the
 * JSONL — so both are rebuilt inside the copy by the two commands entitled to
 * write them.
 *
 * ── WHAT THIS FILE MUST NOT ASSERT ─────────────────────────────────────────
 *
 * Not a record count, not a bucket total, not an id. The corpus grows. What is
 * asserted is the DIFFERENCE between two readings of the same screen taken
 * minutes apart in the same run, and the vocabulary the refusal is drawn in —
 * which is the server's own sentence and therefore cannot drift from it.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { removeTree } from '../test/helpers/tmp.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { CORPUS } from './app.ts';
import { DIR_NAME } from '../src/core/workspace.ts';

const CLI = path.resolve(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

/**
 * Every SQLite file goes; everything else — the items, the audit JSONL, the
 * seen files, the revisions, the import records — comes. See the header for
 * why this is not `worthCopying`.
 */
function copyable(source: string): boolean {
  const name = path.basename(source);
  return !name.startsWith('.index.db') && !name.startsWith('audit.db');
}

/**
 * A private copy of the served corpus, with its index and audit projection
 * REBUILT rather than copied.
 *
 * **The JSONL is truncated to its last complete line.** Another worker's
 * server may append a refusal record to `.demo-corpus`'s log at any moment —
 * `e2e/nocred-notice.spec.ts` opens a credential-less page over that very
 * corpus — so a copy taken mid-append can end in half a record. `mycontext
 * audit` would then refuse, and the refusal would look exactly like the state
 * under test while meaning something else entirely. Dropping a trailing
 * partial line costs one record and removes a whole class of confusing red.
 */
function isolatedCorpus(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-refusal-'));
  cpSync(CORPUS, root, { recursive: true, filter: copyable });

  const log = path.join(root, DIR_NAME, '.audit', 'audit.jsonl');
  const raw = readFileSync(log, 'utf8');
  if (!raw.endsWith('\n')) writeFileSync(log, raw.slice(0, raw.lastIndexOf('\n') + 1));

  // `rebuild` writes the item index the SQLite-backed routes open read-only
  // and cannot create; `audit` folds the JSONL into `.audit/audit.db` and is
  // the ONLY caller entitled to write it. Both throw on failure: a workspace
  // that could not be prepared is a measurement about to be taken against
  // screens refusing for the wrong reason.
  for (const command of [['rebuild'], ['audit', '--limit', '1']]) {
    execFileSync(process.execPath, [CLI, ...command], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  }
  return root;
}

/** The refusals the Watch screen draws — `pulseFault` and `feedFault`. */
const screenFaults = (page: Page) => page.locator('#pulse ~ .spill:visible');

/** The literal state chip the pulse draws for a projection that was never built. */
const absentChip = (page: Page) => page.locator('#pulse .chip');

/** Open Watch and wait for the screen to have finished its reads. */
async function showWatch(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/watch'; });
  await expect(
    page.locator('#pulse'),
    'the Watch screen never drew its pulse plate — nothing below measures a screen that did not render',
  ).toBeAttached({ timeout: 20_000 });
}

test('one unauthenticated request puts the served corpus in refusal, and the app draws the refusal rather than zeroes', async ({ page }) => {
  const root = isolatedCorpus();
  let harness: UiHarness | undefined;
  try {
    harness = await startUiChild(root);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(
      page.locator('.nav').first(),
      'the app never rendered a rail button — it probably has no token',
    ).toBeVisible({ timeout: 15_000 });

    // ── 1 · THE HEALTHY READING ──────────────────────────────────────────
    //
    // Taken first and asserted, because the second half of this test is a
    // DIFFERENCE and a difference from an unknown state is not a measurement.
    // A corpus whose projection was already behind would draw the refusal here
    // too, and the test would pass having proved nothing.
    await showWatch(page);
    await expect(
      screenFaults(page),
      'the Watch screen drew a refusal over a corpus whose projection was just built — the '
      + 'comparison below would then measure nothing, because both readings would be refusals',
    ).toHaveCount(0, { timeout: 20_000 });
    await expect(
      absentChip(page),
      'the pulse drew its `absent` state chip over a projection that was just built. Absent means '
      + 'NEVER BUILT; this workspace ran `mycontext audit` before the server started',
    ).toHaveCount(0);

    // ── 2 · ONE REFUSAL, WHICH IS THE READ SURFACE'S ONLY WRITE ──────────
    //
    // No `recordAudit`, no file touched by this test: an unauthenticated GET,
    // which the gate answers 401 and records as an `access` row. The log is
    // now one record past the projection, and `readProjection` refuses every
    // read that goes through it — because syncing is a write and a read
    // surface may not perform one.
    //
    // **Made from NODE and not from the page.** A `fetch` inside the browser
    // is same-origin, so it carries the `mycontext_token` cookie the boot set
    // and is answered 200 — measured, on the first run of this test. That is
    // the gate working; it is simply not the request this needs. A request
    // from outside the browser holds no cookie and no header, which is exactly
    // the bookmark case `e2e/nocred-notice.spec.ts` reproduces.
    const refused = (await fetch(`http://127.0.0.1:${h.port}/api/ping`)).status;
    expect(
      refused,
      'the unauthenticated request was not refused, so no `access` record was written and the '
      + 'corpus is not in the state the rest of this test is about',
    ).toBe(401);

    // ── 3 · THE STALE READING ────────────────────────────────────────────
    //
    // Navigate away and back, which re-runs the screen's own render and its
    // reads. Not a reload: a reload would also re-boot the shell, and what is
    // under test is what a screen does when the corpus moves under a page that
    // is already open — which is the situation a reader is actually in.
    await page.evaluate(() => { location.hash = '#/status'; });
    await showWatch(page);

    const fault = screenFaults(page).first();
    await expect(
      fault,
      'a single unauthenticated request left the projection behind its log, both projection reads '
      + 'refused with 503, and the screen showed no refusal at all — a reader is left looking at '
      + 'an empty chart that means "could not read" while it reads as "nothing happened"',
    ).toBeVisible({ timeout: 20_000 });

    // The SERVER'S OWN WORDS, so this cannot drift from the message: it names
    // the state, names why a read surface may not repair it, and names the one
    // command that ends it.
    await expect(fault, 'the refusal does not name the state').toContainText('behind');
    await expect(fault, 'the refusal does not name the remedy').toContainText('mycontext audit');

    // **And it is NOT drawn as the absent state.** This is the whole ruling in
    // one assertion. `absent` means the projection was never built and there is
    // nothing to read; `behind` means it exists and may not be trusted. A
    // screen that collapsed the two would tell a reader to build something that
    // is already there, and would report a measured history as an unmeasured
    // one.
    await expect(
      absentChip(page),
      'a projection BEHIND its log was drawn with the `absent` state chip. Absent and stale are '
      + 'opposite facts — one says nothing has ever read this log, the other says something has '
      + 'and it is out of date — and only one of them is fixed by the command on screen',
    ).toHaveCount(0);

    // **Nor as zeroes.** `applyVolume` draws no chart at all on a refusal, and
    // that is the point: 120 zero columns would be a chart asserting that
    // nothing happened over a log nothing was allowed to read.
    // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
    await expect(
      page.locator('#pulse .bar, #pulse .col, #pulse svg'),
      'the pulse drew a chart beside a refusal that says its own numbers could not be read — an '
      + 'unmeasured thing must not be drawn as a measured zero',
    ).toHaveCount(0);

    // The feed is NOT blank beside the refusal: the stream reads the JSONL
    // directly, which is AHEAD of the projection rather than behind it. Asserted
    // as "some rows", never as a count — the corpus grows.
    await expect
      .poll(async () => await page.locator('#atbl tr:not(.regime)').count(), {
        message: 'the projection refused and the feed drew nothing, so the reader is left with a '
          + 'refusal and a blank table over a log that holds every record the refusal is about',
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
  } finally {
    if (harness !== undefined) await harness.stop();
    removeTree(root);
  }
});
