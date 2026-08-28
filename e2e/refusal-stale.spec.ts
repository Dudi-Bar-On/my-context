/**
 * **Absent is not stale, stale is not zero — and a projection behind its log
 * must be drawn as a refusal over the SERVED CORPUS, not only over a fixture.**
 *
 * The owner's ruling on
 * `TASK-point-the-e2e-suite-at-the-served-corpus-not-only-at-the` names four
 * shapes a browser test over real data has to hold, and this file is the
 * fourth: *"a 503 that renders as the stale state rather than as zeroes"*.
 *
 * Verified 2026-08-26 and still true: **no absent-versus-stale assertion exists
 * under the app fixture at all.** `e2e/screen-parity.spec.ts` narrates the
 * hazard in a comment and asserts nothing about it. `e2e/watch-feed.spec.ts`
 * does assert both states and asserts them well — but over a five-record corpus
 * it builds itself. That leaves this file's subject: **the same refusal over
 * the served corpus**, at the size and shape the other specs measure. A refusal
 * drawn correctly over five records says nothing about a screen with 900-odd of
 * them to lose.
 *
 * ── WHAT THIS FILE USED TO CLAIM, AND WHY IT NO LONGER DOES ────────────────
 *
 * Until `plan:walk` seq:28 this file reached the stale state by making ONE
 * UNAUTHENTICATED REQUEST, and its name said so. That worked because a refusal
 * is itself an audit record — the read surface's only write — so a 401 moved
 * the log one record past the projection and every authorised read after it
 * answered 503. The task that wrote this file called that "the product's
 * documented behaviour", and it was.
 *
 * **It was also a real hazard, and seq:28 abolished it.** `recordAudit` — the
 * single place an audit record is appended — now projects what it appends
 * (`src/core/audit-db.ts` · `export function keepProjectionCurrent(`), at a
 * measured ~2.3 ms that is flat in the size of the log. **Ordinary work no
 * longer leaves the audit projection behind its log**, and a 401 in particular
 * no longer stales anything. Section 2 below is that guarantee, asserted where
 * a reader would meet it: on the screen, not on the endpoint.
 *
 * ── HOW THE STATE IS REACHED NOW ───────────────────────────────────────────
 *
 * `behind`, `diverged`, `ProjectionStaleError` and the 503 are all still live
 * and still correct. What changed is how often a corpus ARRIVES at them, not
 * what a screen owes a reader when it does — and this file is about the second,
 * so it re-points rather than retires.
 *
 * `test/helpers/unprojected-audit.ts` is the route, and its header lists the
 * four ways a real corpus still takes it: a record written by a build older
 * than seq:28, in a log that outlives the build that wrote it; a log or an
 * `.audit/` directory copied in from another machine; an append whose upkeep
 * returned `failed`; and every append after a divergence, which a write path
 * may not repair. The helper writes the line exactly as `recordAudit` writes it
 * — same protocol, same stamping rule for `at` — and then stops, which is
 * precisely the state all four leave behind. **It is not a way of faking the
 * state; it is the state, reached in one step instead of four.**
 *
 * ── WHY AN ISOLATED COPY AND NOT `.demo-corpus` ITSELF ─────────────────────
 *
 * Because this test PUTS A CORPUS INTO REFUSAL, and `.demo-corpus` is shared
 * by every other spec in the run. `e2e/simulate-slider.spec.ts` carries this
 * project's account of what a spec that writes shared state costs; the
 * disposable `mkdtemp` copy is `e2e/execute.spec.ts`'s answer to the same
 * hazard and this file follows it. Note that this is now the ONLY reason the
 * copy exists — before seq:28 the shared corpus was one bookmark away from
 * refusing on its own, which is the parallelism flake seq:28's report closes.
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
 * asserted is the DIFFERENCE between readings of the same screen taken minutes
 * apart in the same run, and the vocabulary the refusal is drawn in — which is
 * the server's own sentence and therefore cannot drift from it.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { removeTree } from '../test/helpers/tmp.ts';
import { appendUnprojected } from '../test/helpers/unprojected-audit.ts';
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
 * **The JSONL is truncated to its last complete line.** A copy taken while
 * another process is mid-append can end in half a record — `e2e/execute.spec.ts`
 * writes through the CLI over its own copy of this corpus, and the demo build
 * itself appends — so `mycontext audit` would then refuse, and the refusal
 * would look exactly like the state under test while meaning something else
 * entirely. Dropping a trailing partial line costs one record and removes a
 * whole class of confusing red.
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

/**
 * The drawn series itself.
 *
 * Named once because it is asserted in BOTH directions, and the pair is the
 * property this file exists for: PRESENT while the projection is readable,
 * ABSENT — not zeroed — while it refuses. `applyVolume` draws no chart at all
 * on a refusal, because 120 zero columns would be a chart asserting that
 * nothing happened over a log nothing was allowed to read
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`).
 */
const pulseChart = (page: Page) => page.locator('#pulse .bar, #pulse .col, #pulse svg');

/** Open Watch and wait for the screen to have finished its reads. */
async function showWatch(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/watch'; });
  await expect(
    page.locator('#pulse'),
    'the Watch screen never drew its pulse plate — nothing below measures a screen that did not render',
  ).toBeAttached({ timeout: 20_000 });
}

/**
 * Leave Watch and come back, which re-runs the screen's own render and its
 * reads.
 *
 * Not a reload: a reload would also re-boot the shell, and what is under test
 * is what a screen does when the corpus moves under a page that is already
 * open — which is the situation a reader is actually in.
 */
async function redrawWatch(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/status'; });
  await showWatch(page);
}

test('a projection behind its log puts the served corpus in refusal, and the app draws the refusal rather than zeroes', async ({ page }) => {
  const root = isolatedCorpus();
  // What `recordAudit` and `appendUnprojected` both take: the workspace
  // directory, not the repository root the server is started in.
  const workspace = path.join(root, DIR_NAME);
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
    // Taken first and asserted, because the last section of this test is a
    // DIFFERENCE and a difference from an unknown state is not a measurement.
    // A corpus whose projection was already behind would draw the refusal here
    // too, and the test would pass having proved nothing.
    await showWatch(page);
    // **Waited for FIRST, and the two absences below depend on it having been.**
    // `toHaveCount(0)` is satisfied by the instant before a read returns, so an
    // absence asserted against a screen still fetching passes without measuring
    // anything. The series appearing is the projection read having ANSWERED,
    // which is what makes "and no refusal beside it" a fact rather than a race.
    await expect(
      pulseChart(page),
      'the pulse drew no series at all over a readable projection, so the "no chart beside a '
      + 'refusal" assertion at the end of this test would hold over a screen that never draws one '
      + 'and would prove nothing',
    ).not.toHaveCount(0, { timeout: 20_000 });
    await expect(
      screenFaults(page),
      'the Watch screen drew a refusal over a corpus whose projection was just built — the '
      + 'comparison below would then measure nothing, because both readings would be refusals',
    ).toHaveCount(0);
    await expect(
      absentChip(page),
      'the pulse drew its `absent` state chip over a projection that was just built. Absent means '
      + 'NEVER BUILT; this workspace ran `mycontext audit` before the server started',
    ).toHaveCount(0);

    // ── 2 · ONE REFUSAL, WHICH NO LONGER STALES ANYTHING ─────────────────
    //
    // **This section used to BE the test, and it now asserts the opposite.**
    // An unauthenticated GET is still the read surface's one write — the gate
    // answers 401 and records an `access` row — but since `plan:walk` seq:28
    // `recordAudit` projects what it appends, so the log and the projection
    // move together and the next authorised read is answered rather than
    // refused.
    //
    // Kept in a BROWSER test even though `test/ui/watch-e2e.test.ts` asserts
    // the endpoint's `projectionState` directly, because the two see different
    // things. The unit layer sees a field on a JSON body. This sees what the
    // guarantee is worth to a reader: a screen that another tab's bookmark
    // cannot put into refusal, still drawing its series. That is the
    // parallelism flake seq:28's report closes —
    // `e2e/nocred-notice.spec.ts` opens a credential-less page over the shared
    // corpus and provoked it every run.
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
      'the unauthenticated request was not refused, so no `access` record was written and this '
      + 'section measured nothing about what a refusal does to the projection',
    ).toBe(401);

    await redrawWatch(page);
    // **The drawn series first, and the absence of a refusal second.** An
    // absence asserted against a screen still doing its reads is satisfied by
    // the moment before the read returns, so `toHaveCount(0)` on its own here
    // would pass over a corpus in refusal. Waiting for the chart to appear
    // waits for the projection read to have ANSWERED; only then does the
    // absence of a refusal beside it mean anything.
    await expect(
      pulseChart(page),
      'the pulse stopped drawing its series after a 401, which is the refusal arriving by another '
      + 'route: a screen that draws nothing is a screen whose projection read did not answer',
    ).not.toHaveCount(0, { timeout: 20_000 });
    await expect(
      screenFaults(page),
      'an unauthenticated request left the served corpus in refusal. `recordAudit` is supposed to '
      + 'project the refusal record it appends, so the projection should have moved with the log — '
      + 'one bookmark, one stale cookie or one second tab must not be able to put every screen '
      + 'reading this corpus into 503',
    ).toHaveCount(0);

    // ── 3 · A PROJECTION GENUINELY BEHIND ITS LOG ────────────────────────
    //
    // One record in the log the projection has not consumed, written exactly as
    // the appender writes it and with no upkeep after it — see the header, and
    // `test/helpers/unprojected-audit.ts` for the four ways a real corpus
    // arrives here. `readProjection` refuses every read that goes through it,
    // because syncing is a write and a read surface may not perform one.
    //
    // Written while the page is OPEN, deliberately: a corpus moving under a
    // reader is the situation this screen exists to survive.
    appendUnprojected(workspace, {
      kind: 'focus', op: 'focus-set', origin: 'human', note: 'scope=src/**',
    });

    // ── 4 · THE STALE READING ────────────────────────────────────────────
    await redrawWatch(page);

    const fault = screenFaults(page).first();
    await expect(
      fault,
      'the projection was left behind its log, both projection reads refused with 503, and the '
      + 'screen showed no refusal at all — a reader is left looking at an empty chart that means '
      + '"could not read" while it reads as "nothing happened"',
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

    // **Nor as zeroes.** The same locator that had to be non-empty in sections
    // 1 and 2 has to be empty here: 120 zero columns would be a chart asserting
    // that nothing happened over a log nothing was allowed to read.
    await expect(
      pulseChart(page),
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
