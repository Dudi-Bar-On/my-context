/**
 * **The owner's report, in a browser: *"the audit stream is blank without
 * records, i think it is a bug"*.** (`plan:walk` seq:52 and seq:53.)
 *
 * He was right, and the two causes are two different reads failing at once —
 * which is why they are one symptom and one spec:
 *
 *   1. the feed's only live source, `/api/watch/stream`, was a tail starting at
 *      the current EOFs, so it emitted nothing until something was appended;
 *   2. its two other sources, `/api/watch/volume` and `/api/ask/audit`, both go
 *      through `readProjection`, which answers with NO data when the projection
 *      was never built and REFUSES when it is behind its log.
 *
 * On the real corpus `audit.db` was stamped 12:34 against an `audit.jsonl` at
 * 15:46, so every one of the three had nothing to draw and the screen was
 * blank. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` is the
 * standard that reading breaks: an empty live tail is UNMEASURED — it means
 * "nothing since you opened this", not "no records" — and a reader is entitled
 * to be told which.
 *
 * ── WHY THIS SPEC BUILDS ITS OWN CORPUS ────────────────────────────────────
 *
 * `e2e/app.ts` opens `.demo-corpus` and SYNCS its projection first, on purpose:
 * `screen-parity.spec.ts` measures gaps and a corpus in refusal reports code
 * gaps that are only data gaps. That fixture therefore cannot reach either
 * state under test here — the whole subject is a projection that is absent or
 * behind. So this file starts its own server over a temporary corpus it
 * controls, using the same harness the node suite uses.
 *
 * ── WHAT `pulseFault` TURNED OUT TO BE ─────────────────────────────────────
 *
 * The task asked whether `watch.js`'s `pulseFault` region actually fires and is
 * visible on this path, or whether the owner simply saw an empty pulse beside
 * an empty feed. The second test below is that question, measured rather than
 * assumed: it builds a projection, puts one record in the log that the
 * projection has not consumed, and asserts the region is VISIBLE and carries
 * the server's own words including the remedy. It passes — the refusal was
 * never the missing half. What was missing is everything the third read could
 * have drawn while the other two refused, which is what the backlog is.
 *
 * ── HOW `behind` IS REACHED HERE, AND WHY IT MOVED ─────────────────────────
 *
 * This file used to reach `behind` with a plain `recordAudit` append after
 * `mycontext audit`, and that worked because an append left the projection
 * behind. `plan:walk` seq:28 ended that: `recordAudit` — the one place a record
 * is appended — now projects what it appends
 * (`src/core/audit-db.ts` · `export function keepProjectionCurrent(`), at a
 * measured ~2.3 ms that is flat in the size of the log. **Ordinary work no
 * longer leaves the audit projection behind its log**, which is the whole point
 * of the change: before it, one unauthenticated request was enough to stale a
 * shared projection, because a refusal is itself an audit record.
 *
 * **`behind` is still live, still correct, and still reachable**, which is why
 * it is still tested here rather than deleted. It is reached now by
 * `test/helpers/unprojected-audit.ts`, whose header lists the four routes a
 * real corpus takes to it — a record from an older build, a log copied in from
 * another machine, an append whose upkeep returned `failed`, and every append
 * after a divergence. The helper writes the line exactly as `recordAudit`
 * writes it and then stops, which is precisely the state all four leave behind.
 * What changed is how OFTEN a corpus arrives here, not what the screen owes a
 * reader when it does — and this file is about the second.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { recordAudit } from '../src/core/audit.ts';
import { appendUnprojected } from '../test/helpers/unprojected-audit.ts';
import { DIR_NAME } from '../src/core/workspace.ts';

/** How many records the fixture writes before the page ever opens. */
const SEEDED = 5;

interface Fixture {
  page: Page;
  /** The workspace root — what `recordAudit` takes, so a test can append while watching. */
  corpus: string;
}

/**
 * A corpus, a server over it, and the Watch screen open on it.
 *
 * `buildProjection` is the ONE lever: `mycontext audit` is the only caller
 * entitled to write `.audit/audit.db`, and whether it has run — and whether the
 * log grew afterwards — is the whole difference between the three states this
 * file measures.
 */
async function watching(
  page: Page,
  options: { buildProjection: boolean; thenAppend?: boolean },
  body: (fixture: Fixture) => Promise<void>,
): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-watch-feed-'));
  const corpus = path.join(dir, DIR_NAME);
  let harness: UiHarness | undefined;
  try {
    expect(runCli(['init'], dir, () => {}), 'fixture command failed: init').toBe(0);
    for (let i = 0; i < SEEDED; i += 1) {
      recordAudit(corpus, {
        kind: 'mutation', op: 'create', origin: 'human', itemId: `RULE-seed-${i}`, fields: ['body'],
      });
    }
    if (options.buildProjection) {
      expect(runCli(['audit'], dir, () => {}), 'fixture command failed: audit').toBe(0);
    }
    if (options.thenAppend === true) {
      // The log moves PAST the projection. This is the corpus the owner had:
      // `readProjection` now refuses every read that goes through it.
      //
      // **Appended AROUND `recordAudit`, deliberately.** `recordAudit` projects
      // what it appends since `plan:walk` seq:28, so it can no longer produce
      // this state and a test that asked it to would be asserting nothing. The
      // helper writes the same line the appender writes and performs no upkeep
      // — the state left by an append whose upkeep returned `failed`, by a log
      // carried in from another machine, or by every append following a
      // divergence. See the file header and
      // `test/helpers/unprojected-audit.ts`.
      appendUnprojected(corpus, {
        kind: 'focus', op: 'focus-set', origin: 'human', note: 'scope=src/**',
      });
    }

    harness = await startUiChild(dir);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(
      page.locator('.nav').first(),
      'the app never rendered a rail button — it probably has no token',
    ).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => { location.hash = '#/watch'; });
    await body({ page, corpus });
  } finally {
    if (harness !== undefined) await harness.stop();
    removeTree(dir);
  }
}

/** Every row the feed drew, minus the boundary rules, which are not records. */
const recordRows = (page: Page) => page.locator('#atbl tr:not(.regime)');

/**
 * The history/live boundary specifically, and not every `tr.regime`.
 *
 * A FOCUS record is drawn as a regime rule too — it is the design's other
 * boundary and the class they share is deliberate (see `historyBoundary` in
 * `screens/watch.js`) — so a bare `tr.regime` count would pass or fail on
 * whether the fixture happened to record a focus change.
 */
const historyRule = (page: Page) =>
  page.locator('#atbl tr.regime').filter({ hasText: /already in the log/i });

/**
 * Refusals drawn by THIS SCREEN — `pulseFault` and `feedFault`, which are the
 * two siblings `screens/watch.js` appends after `#pulse`.
 *
 * **Scoped this tightly because `main` is not one screen.** The shell keeps a
 * section per VISITED screen inside `#screen` and merely flips `hidden` on the
 * ones it is not showing, so `main .spill` also matches refusals left behind by
 * whatever screen the app booted on. Measured here on 2026-08-27: that first
 * screen had drawn `unable to open database file` — this spec's own worker
 * process holds the corpus index open while the child server tries to read it —
 * and an unscoped locator reported the pulse's refusal missing while it was
 * rendered correctly two elements away.
 */
const screenFaults = (page: Page) => page.locator('#pulse ~ .spill');

test('a corpus with NO projection still draws its own log — the blank feed, fixed', async ({ page }) => {
  await watching(page, { buildProjection: false }, async ({ page: p }) => {
    // The two projection reads answer with nothing: `/api/watch/volume` draws
    // the `absent` chip instead of 120 zero columns, and `/api/ask/audit`
    // returns an empty record list. Before the stream carried a backlog, that
    // left the table with nothing in it and no explanation — exactly what was
    // reported.
    await expect(
      recordRows(p),
      'the feed drew no rows over a corpus whose JSONL holds records. The stream is the only '
      + 'source that reads the log directly, so if it starts at EOF nothing on this screen can '
      + 'draw a corpus whose projection was never built',
    ).toHaveCount(await expectedAtLeast(p, SEEDED), { timeout: 20_000 });

    // `REQ-every-list-and-table-declares-what-leaves-it-and-when-and`: the
    // replay is bounded and the block says so, in the same place and the same
    // shape `boundedList` says it.
    const bound = p.locator('#wbound');
    await expect(bound, 'the replay drew rows and declared nothing about its bound').toBeVisible();
    await expect(bound).toContainText(/already in the log/i);

    // And the pulse still says what it could not measure, rather than drawing a
    // chart of zeroes over a log it has not read.
    await expect(p.locator('#pulse .chip')).toHaveText('absent');
  });
});

/**
 * The number of rows to expect is "at least what was seeded", not an equality:
 * the fixture's own `init` writes audit records too, and so does anything the
 * server does on the way in. An equality here would be a test about the
 * fixture's bookkeeping rather than about the feed.
 */
async function expectedAtLeast(page: Page, seeded: number): Promise<number> {
  await expect
    .poll(async () => (await recordRows(page).count()), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(seeded);
  return await recordRows(page).count();
}

test('a projection BEHIND its log: the refusal is drawn in the server\'s words, and the feed still fills', async ({ page }) => {
  await watching(page, { buildProjection: true, thenAppend: true }, async ({ page: p }) => {
    // **The `pulseFault` question, measured.** It fires, it is visible, and it
    // carries the server's own sentence — which names the state, names why a
    // read surface may not repair it, and names the command that ends it.
    const fault = screenFaults(p).first();
    await expect(
      fault,
      'a projection behind its log refused both projection reads and the screen showed no '
      + 'refusal at all — the 503 body names the remedy and a reader never saw it',
    ).toBeVisible({ timeout: 20_000 });
    await expect(fault).toContainText('mycontext audit');
    await expect(fault).toContainText('behind');

    // Said ONCE. The pulse and the backlog read the same projection through the
    // same door and refuse with a byte-identical message; the screen collapses
    // the duplicate deliberately.
    await expect(p.locator('#pulse ~ .spill:visible')).toHaveCount(1);

    // And the feed is NOT blank beside it. This is the whole fix: the stream
    // reads the JSONL, which is ahead of the projection rather than behind it.
    await expect(
      recordRows(p),
      'the projection refused and the feed drew nothing — the reader is left with a refusal and '
      + 'a blank table over a log that holds every record the refusal is about',
    ).toHaveCount(await expectedAtLeast(p, SEEDED), { timeout: 20_000 });
  });
});

test('what arrived while you watched is drawn apart from what was already there', async ({ page }) => {
  await watching(page, { buildProjection: false }, async ({ page: p, corpus }) => {
    await expectedAtLeast(p, SEEDED);
    // No boundary yet: everything on screen is history, and a rule with nothing
    // on one side of it separates nothing.
    await expect(historyRule(p)).toHaveCount(0);

    const before = await recordRows(p).count();
    recordAudit(corpus, {
      kind: 'mutation', op: 'update', origin: 'human', itemId: 'RULE-live', fields: ['title'],
    });

    // The live record arrives, and the boundary appears with it — exactly one,
    // and the new row is ABOVE it.
    await expect(recordRows(p)).toHaveCount(before + 1, { timeout: 20_000 });
    await expect(
      historyRule(p),
      'a record arrived while the reader watched and nothing on screen tells it from the replayed '
      + 'history — the backlog would then only have relocated the confusion it was added to end',
    ).toHaveCount(1);
    const rows = p.locator('#atbl tr');
    await expect(rows.first()).toContainText('RULE-live');
    await expect(rows.nth(1)).toHaveClass(/regime/);
  });
});
