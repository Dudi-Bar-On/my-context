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

/**
 * **The root cause, proven on the live screen rather than reasoned about.**
 *
 * `agent-step` and `subagent-stop` share one platform event, `SubagentStop`;
 * `agent-dispatched` reuses `PostToolUse`, the same event the ordinary
 * `post-tool-use` op fires on. `whatOf` (`screens/watch.js`) used to lead a
 * hook row with the EVENT, which was fine while every hook op had one to
 * itself and stopped being fine the moment two didn't: an `agent-step` row and
 * a `subagent-stop` row both read `SubagentStop` and nothing on screen could
 * tell them apart, and an `agent-dispatched` row read `PostToolUse` — the same
 * word an ordinary tool-use hook shows — with no way to see it was a dispatch.
 *
 * This asserts the fix at the screen: three records that would have collided
 * or misnamed themselves under the old rendering now read as three different
 * things, each naming its OWN op.
 */
test('an agent-step row, a subagent-stop row and an agent-dispatched row each name themselves', async ({ page }) => {
  await watching(page, { buildProjection: false }, async ({ page: p, corpus }) => {
    await expectedAtLeast(p, SEEDED);

    // The marker text carries no op name — `toContainText('agent-step')` below
    // must find that word because `whatOf` rendered the OP, not because it
    // leaked out of this fixture's own note text.
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-step', hook: 'SubagentStop', origin: 'agent',
      note: 'Bash: run something (feed-marker-alpha)',
    });
    recordAudit(corpus, {
      kind: 'hook', op: 'subagent-stop', hook: 'SubagentStop', origin: 'agent',
      note: 'delivery=finished (feed-marker-bravo)',
    });
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-dispatched', hook: 'PostToolUse', origin: 'agent',
      note: 'type=general-purpose (feed-marker-charlie)',
    });

    const stepRow = p.locator('#atbl tr', { hasText: 'feed-marker-alpha' });
    const stopRow = p.locator('#atbl tr', { hasText: 'feed-marker-bravo' });
    const dispatchRow = p.locator('#atbl tr', { hasText: 'feed-marker-charlie' });
    await expect(stepRow).toBeVisible({ timeout: 20_000 });
    await expect(stopRow).toBeVisible({ timeout: 20_000 });
    await expect(dispatchRow).toBeVisible({ timeout: 20_000 });

    // Two rows sharing the ONE event `SubagentStop` are told apart by their
    // OWN op, not by the event both fired on.
    await expect(stepRow).toContainText('agent-step');
    await expect(stopRow).toContainText('subagent-stop');
    const stepText = await stepRow.innerText();
    const stopText = await stopRow.innerText();
    if (stepText === stopText) {
      throw new Error('an agent-step row and a subagent-stop row rendered identically');
    }

    // A dispatch reads as a dispatch, not as the ordinary `PostToolUse` tool
    // hook it shares its event with.
    await expect(dispatchRow).toContainText('agent-dispatched');

    // The event is not lost either — see the docblock in `whatOf` for why
    // that would trade one blindness for another.
    await expect(stepRow).toContainText('SubagentStop');
    await expect(stopRow).toContainText('SubagentStop');
    await expect(dispatchRow).toContainText('PostToolUse');
  });
});

/**
 * **The lane grouping the owner approved: one foldable row per dispatch.**
 *
 * `agent-dispatched`, `agent-step` and `subagent-stop` join on `agent=<id>`,
 * the field every one of their own notes already carries
 * (`core/audit.ts` · `HOOK_OPS`'s comment). This is the 58%-of-the-screen
 * shape from the owner's measurement, fixed at the render layer: the
 * dispatch is the group's anchor because it is the only row that carries
 * both the lane's purpose and its real agent type, its steps fold underneath
 * it rather than scattering across the feed, and the raw `subagent-stop`
 * sentence — `delivery=finished agent=<id> type=<type>; its seen file was
 * left in place` — is summarised into the anchor rather than drawn again on
 * its own.
 */
test('a lane groups into one foldable row, with its steps folded underneath', async ({ page }) => {
  await watching(page, { buildProjection: false }, async ({ page: p, corpus }) => {
    await expectedAtLeast(p, SEEDED);
    const agentId = 'agent-lane-alpha';
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-dispatched', hook: 'PostToolUse', origin: 'agent',
      note: `dispatched type=general-purpose agent=${agentId}: Six owed read-only MCP tools`,
    });
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-step', hook: 'SubagentStop', origin: 'agent',
      note: `Read: e2e/app.ts agent=${agentId}`,
    });
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-step', hook: 'SubagentStop', origin: 'agent',
      note: `Bash: run checks agent=${agentId}`,
    });
    recordAudit(corpus, {
      kind: 'hook', op: 'subagent-stop', hook: 'SubagentStop', origin: 'agent',
      note: `delivery=finished agent=${agentId} type=general-purpose; its seen file was left in place`,
    });

    const groupRow = p.locator('#atbl tr', { hasText: 'Six owed read-only MCP tools' });
    await expect(groupRow, 'the dispatch row is the group\'s anchor and must carry the purpose')
      .toBeVisible({ timeout: 20_000 });
    await expect(groupRow).toContainText('agent-dispatched');
    await expect(groupRow).toContainText('general-purpose');
    await expect(groupRow, 'the group must say how many steps it folds').toContainText('2');
    await expect(groupRow, 'a stopped lane must say so').toContainText('finished');

    // The steps are folded — not drawn as their own rows — until expanded.
    await expect(
      p.locator('#atbl tr', { hasText: 'Read: e2e/app.ts' }),
      'a naive append-as-they-arrive would have scattered this step into its own row',
    ).toHaveCount(0);

    // The raw stop sentence never reaches the screen on its own — it is
    // summarised into the group's own anchor instead.
    await expect(
      p.locator('#atbl tr', { hasText: 'its seen file was left in place' }),
      'the meaningless raw subagent-stop row must not survive the reformat',
    ).toHaveCount(0);

    await groupRow.locator('button.lanetoggle').click();
    // The tool and its subject land in their OWN columns (who / detail) —
    // no colon glues them back into one string once the columns exist.
    const stepOne = p.locator('#atbl tr', { hasText: 'e2e/app.ts' });
    await expect(stepOne).toBeVisible();
    await expect(stepOne).toContainText('Read');
    const stepTwo = p.locator('#atbl tr', { hasText: 'run checks' });
    await expect(stepTwo).toBeVisible();
    await expect(stepTwo).toContainText('Bash');
  });
});

/** A lane still running has no stop row, and must not be drawn as though it finished. */
test('a lane with no stop yet renders as running, not as a group that lies about being complete', async ({ page }) => {
  await watching(page, { buildProjection: false }, async ({ page: p, corpus }) => {
    await expectedAtLeast(p, SEEDED);
    // Named to NOT itself contain the word "running" — a naive substring
    // match against the id would make this assertion pass for the wrong
    // reason, and this fixture is deliberately built to catch that.
    const agentId = 'agent-lane-inflight';
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-dispatched', hook: 'PostToolUse', origin: 'agent',
      note: `dispatched type=general-purpose agent=${agentId}: Still working on it`,
    });
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-step', hook: 'SubagentStop', origin: 'agent',
      note: `Read: e2e/still-running.ts agent=${agentId}`,
    });

    const groupRow = p.locator('#atbl tr', { hasText: 'Still working on it' });
    await expect(groupRow).toBeVisible({ timeout: 20_000 });
    await expect(groupRow).toContainText('running');
    await expect(groupRow).not.toContainText('finished');
  });
});

/**
 * When the dispatch is not in the backlog window, the screen must not invent
 * a label for it — it shows the id and says the dispatch is not in view.
 */
test('a step whose dispatch is out of view names the id and says so, and invents nothing', async ({ page }) => {
  await watching(page, { buildProjection: false }, async ({ page: p, corpus }) => {
    await expectedAtLeast(p, SEEDED);
    const agentId = 'agent-orphan-zulu';
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-step', hook: 'SubagentStop', origin: 'agent',
      note: `Read: e2e/orphan.ts agent=${agentId}`,
    });

    const row = p.locator('#atbl tr', { hasText: agentId });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText(/not in view/i);
  });
});

/** The filter row's own count, from what the feed actually holds — not a second source. */
test('a kind filter button shows how many records of that kind are on the feed', async ({ page }) => {
  await watching(page, { buildProjection: false }, async ({ page: p }) => {
    await expectedAtLeast(p, SEEDED);
    const mutationButton = p.locator('#wfilters button[data-k="mutation"]');
    await expect(mutationButton).toBeVisible({ timeout: 20_000 });
    await expect(mutationButton).toContainText(String(SEEDED));
  });
});

/**
 * **`TASK-a-lane-backfills-more-steps-than-the-feed-window-holds-so`.**
 *
 * Measured live: a lane recording more steps than the backlog window holds
 * is GUARANTEED to push its own dispatch out of that window — the dispatch
 * is written once, at the lane's start; its steps arrive in one burst, at
 * the lane's end. One real lane: 95 steps, dispatch 88 rows back, window 50
 * at the time this was measured.
 *
 * Reproduced here by seeding the corpus BEFORE the page ever opens — a live
 * append (as the other tests in this file use) does not reproduce it, because
 * this screen keeps everything it has seen live regardless of the window; the
 * window only binds the ONE-SHOT `/api/ask/audit?limit=BACKLOG` read a fresh
 * page load makes, which is the read the bug report is about.
 *
 * **Padding raised from 55 to 210 on
 * `TASK-the-audit-stream-shows-almost-nothing-of-what-the-log-holds`,
 * 2026-09-04**, alongside `BACKLOG`'s own move from 50 to `FEED_CAP` (200):
 * the mechanism this fixture proves — a dispatch evicted while its steps stay
 * in view — is a property of the window being SMALLER than the gap between a
 * lane's start and its own backfilled end, not of any particular number, so
 * the padding tracks whatever the window currently is rather than the window
 * that was current when this fixture was first written.
 */
async function watchingBuriedLane(
  page: Page,
  body: (fixture: { page: Page; agentId: string; corpus: string }) => Promise<void>,
): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-watch-feed-'));
  const corpus = path.join(dir, DIR_NAME);
  let harness: UiHarness | undefined;
  try {
    expect(runCli(['init'], dir, () => {}), 'fixture command failed: init').toBe(0);
    // `resolveDispatch`'s own lookup reads `/api/ask/audit`, which reads the
    // PROJECTION — so this fixture needs one built. One build here is
    // enough: `recordAudit` has kept the projection current on every append
    // since `plan:walk seq:28`, so every record below stays visible to that
    // read without a second `mycontext audit` call.
    expect(runCli(['audit'], dir, () => {}), 'fixture command failed: audit').toBe(0);
    const agentId = 'agent-window-victim';
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-dispatched', hook: 'PostToolUse', origin: 'agent',
      note: `dispatched type=general-purpose agent=${agentId}: Buried by its own steps`,
    });
    // Push the dispatch out of the backlog window (`FEED_CAP`, 200) — the
    // exact structural failure the task item measured, reproduced with
    // padding records rather than 95 real steps because the MECHANISM, not
    // the count, is what any window has to fail on once enough separates a
    // lane's start from its own backfilled end. Comfortably past 200 with
    // the six steps below still on the near side of it.
    for (let i = 0; i < 210; i += 1) {
      recordAudit(corpus, {
        kind: 'mutation', op: 'create', origin: 'human', itemId: `RULE-pad-${i}`, fields: ['body'],
      });
    }
    for (let i = 0; i < 6; i += 1) {
      recordAudit(corpus, {
        kind: 'hook', op: 'agent-step', hook: 'SubagentStop', origin: 'agent',
        note: `Read: e2e/file-${i}.ts agent=${agentId}`,
      });
    }

    harness = await startUiChild(dir);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(page.locator('.nav').first()).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => { location.hash = '#/watch'; });
    await body({ page, agentId, corpus });
  } finally {
    if (harness !== undefined) await harness.stop();
    removeTree(dir);
  }
}

test('a lane whose steps evict its own dispatch from the window still draws as ONE row, not one per step', async ({ page }) => {
  await watchingBuriedLane(page, async ({ page: p, agentId }) => {
    const group = p.locator(`#atbl tr[data-agent="${agentId}"]`);
    await expect(
      group,
      'the six steps for this lane must collapse to one row even though the dispatch that would '
      + 'normally anchor them is outside the backlog window',
    ).toHaveCount(1, { timeout: 20_000 });
    await expect(group).toContainText('6');

    // And never as one row per step, which is the exact defect measured on
    // the live corpus (fifty identical `dispatch not in view` rows).
    await expect(p.locator('#atbl tr', { hasText: 'e2e/file-0.ts' })).toHaveCount(0);
  });
});

test('a dispatch out of the window is looked up, and the group ends up naming the lane\'s real purpose', async ({ page }) => {
  await watchingBuriedLane(page, async ({ page: p, agentId }) => {
    const group = p.locator(`#atbl tr[data-agent="${agentId}"]`);
    await expect(group).toBeVisible({ timeout: 20_000 });
    // Playwright's `toContainText` polls — this waits out the lookup's own
    // round trip rather than racing it.
    await expect(
      group,
      'the dispatch is not in the backlog window, but it is findable — `resolveDispatch` should '
      + 'have looked it up and the group should now carry its real purpose, not the bare id',
    ).toContainText('Buried by its own steps', { timeout: 20_000 });
    await expect(group).toContainText(/found beyond the window/i);
  });
});

// --- The whole log, opened cold: TASK-the-audit-stream-shows-almost-nothing --
//
// The report this file is named for: 7 rows on the owner's live screen, one of
// them a step, over a log holding 92 `agent-step` records — and a page left
// open longer had shown 50-60. Reproduced on this repository's own corpus
// (dogfooded, per `INSTR-testing-happens-against-the-current-corpus-and-an-exception`,
// but that instruction governs THIS repo's manual verification, not this
// suite's own temp-corpus fixtures, which is what every other test in this
// file already uses): a 20-record stream fallback opened with every finished
// lane showing "0 steps" — not a partial count, none at all — because a
// `SubagentStop` backfills a lane's steps in one burst and a corpus this
// active writes well over fifty other records around it.
//
// **Not the same failure `TASK-a-lane-backfills-more-steps-than-the-feed-window-holds-so`
// already fixed.** That task made an ORPHANED dispatch — steps present, the
// row naming them evicted — group and resolve correctly for any burst size.
// This is the case its own fix cannot reach: the dispatch, every step, AND
// the stop are ALL outside the window, so there is nothing in the fetch for
// grouping to work with. The only fix available is the one this project uses
// for every other bounded read — widen the window to the feed's own declared
// ceiling (`FEED_CAP`) and disclose the rest — see `screens/watch.js` ·
// `Raised from a bare 20 to FEED_CAP` · for the argument.

/**
 * A lane whose dispatch, steps AND stop are all pushed behind a window small
 * enough to miss them entirely, but well inside `FEED_CAP` (200).
 *
 * `buildProjection: false`, deliberately: `/api/ask/audit` then has nothing
 * to give at all (the `absent` empty state, not a 503), so the STREAM's own
 * backlog — `SHARED_STREAM_BACKLOG` in `app.js` — is the ONLY source on
 * screen, which is exactly the state the owner's corpus was in. A test that
 * left the projection built could pass on the query surface's window alone
 * and never exercise the stream fallback this task is about.
 */
async function watchingWholeLaneBuried(
  page: Page,
  body: (fixture: { page: Page; agentId: string }) => Promise<void>,
): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-watch-feed-'));
  const corpus = path.join(dir, DIR_NAME);
  let harness: UiHarness | undefined;
  try {
    expect(runCli(['init'], dir, () => {}), 'fixture command failed: init').toBe(0);
    const agentId = 'agent-whole-lane-buried';
    recordAudit(corpus, {
      kind: 'hook', op: 'agent-dispatched', hook: 'PostToolUse', origin: 'agent',
      note: `dispatched type=general-purpose agent=${agentId}: Entirely buried lane`,
    });
    for (let i = 0; i < 3; i += 1) {
      recordAudit(corpus, {
        kind: 'hook', op: 'agent-step', hook: 'SubagentStop', origin: 'agent',
        note: `Read: e2e/buried-${i}.ts agent=${agentId}`,
      });
    }
    recordAudit(corpus, {
      kind: 'hook', op: 'subagent-stop', hook: 'SubagentStop', origin: 'agent',
      note: `delivery=finished agent=${agentId} type=general-purpose; its seen file was left in place`,
    });
    // Past the OLD 20-record stream fallback and comfortably inside the NEW
    // 200-record one: this lane's five records sit roughly a hundred rows
    // back, not merely past a small bound picked to graze the edge of one.
    for (let i = 0; i < 100; i += 1) {
      recordAudit(corpus, {
        kind: 'mutation', op: 'create', origin: 'human', itemId: `RULE-buried-pad-${i}`, fields: ['body'],
      });
    }

    harness = await startUiChild(dir);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(page.locator('.nav').first()).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => { location.hash = '#/watch'; });
    await body({ page, agentId });
  } finally {
    if (harness !== undefined) await harness.stop();
    removeTree(dir);
  }
}

test('a lane buried whole behind a hundred other records still renders, once the stream backlog is wide enough to reach it', async ({ page }) => {
  await watchingWholeLaneBuried(page, async ({ page: p, agentId }) => {
    const group = p.locator(`#atbl tr[data-agent="${agentId}"]`);
    await expect(
      group,
      'the dispatch, all three steps and the stop for this lane sit about a hundred records back — '
      + 'a stream backlog that stops short of that leaves this lane with NOTHING on screen, not '
      + 'even an orphan row, because none of its records reached the fetch at all',
    ).toHaveCount(1, { timeout: 20_000 });
    await expect(group).toContainText('Entirely buried lane');
    await expect(group).toContainText('3');
    await expect(group).toContainText('finished');
  });
});

test('the opening bound is disclosed, and it is proportionate to what the log holds rather than a fixed small number', async ({ page }) => {
  await watchingWholeLaneBuried(page, async ({ page: p }) => {
    // 1 (init's own) + 1 dispatch + 3 steps + 1 stop + 100 pad, at minimum —
    // `expectedAtLeast` allows for whatever `init` itself records.
    await expectedAtLeast(p, 100);
    const bound = p.locator('#wbound');
    await expect(bound).toBeVisible();
    await expect(bound).toContainText(/already in the log/i);
  });
});
