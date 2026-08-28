/**
 * `plan:live seq:7` — **the Injection preview is deaf to the two kinds a
 * compaction writes**, measured the only way the defect can be measured: a
 * real compaction against a real page, with nothing reloaded.
 *
 * ── WHY THIS IS A BROWSER TEST AND NOT A LINE IN `test/ui/live-invalidation
 *    .test.ts` ─────────────────────────────────────────────────────────────
 *
 * Because that file already passed. It is the gate that holds
 * `SCREEN_INVALIDATION` to `AUDIT_KINDS`, and it did not catch this: a row
 * carrying the WRONG kinds is perfectly well formed. The task's own bounds
 * say so and rule on it — *"whatever test lands here has to assert BEHAVIOUR
 * … not the table's shape"* — and a test asserting the row now contains two
 * more strings would restate the fix without ever exercising it. So the
 * subject here is the wiring end to end: a record lands on disk, the shell's
 * one stream carries it, `SCREEN_INVALIDATION` decides it matters to the
 * screen on show, and the screen's own numbers change.
 *
 * ── THE ACCEPTANCE CASE IS THE OWNER'S, AND IT IS THE CONTINUITY LANE ─────
 *
 * Owner, 2026-08-28: *"continuity lane also should be triggered by the
 * compact and clear (start) events because there it is or could be
 * changed."*
 *
 * `plan:live seq:9` keys the continuity tier's dedupe on the WINDOW rather
 * than on the id (`core/seen-file.ts` · `export function continuityFor` ·
 * ~215), and a compaction REBUILDS the window. So that tier's delivered /
 * not-delivered state flips at exactly these moments and at no other. For
 * the other four tiers a stale ribbon means the numbers moved; for this one
 * the screen states that the guarantee is in force when it is not, or the
 * reverse — wrong in KIND rather than out of date, which is a short distance
 * from the defect `seq:9` exists to end, arriving on the screen instead of
 * in the injection.
 *
 * **What flips, verified against the endpoints before this file was
 * written.** The corpus below holds one `continuity` item and one session
 * that has already had a session start, so its seen file carries a
 * `continuity` line marked with the session-wide window constant. Previewing
 * `session-start` — the landing event, and the one on screen without
 * touching a control — therefore reports the tier as ALREADY DELIVERED:
 * `0 in`, and no row in Delivered. Drive a real compaction and the last
 * `continuity` line for that id now carries the compaction's own
 * `capturedAt`, which the session-wide constant does not match, so the item
 * is due again: `1 in`, and a row. `0 in → 1 in` is the categorical fact,
 * not a count that drifted.
 *
 * **The event picker is deliberately left alone.** The owner reached this
 * screen with `compact` selected and that is how he found it, but a
 * `refresh: 'ask'` take calls the screen's own `render()`, which rebuilds
 * `#evsel` from `EVENTS[0]` — so a test that picked `compact` first would be
 * measuring the picker's own reset as much as the invalidation, and would
 * measure it against an event whose answer after the take is the same as
 * before. Filed as a concern in this task's report; not this file's subject,
 * and not this file's lane. The landing event carries the same flip and
 * carries it unambiguously.
 *
 * ── ITS OWN CORPUS, BUILT BY THE REAL CODE ───────────────────────────────
 *
 * Not `.demo-corpus` (`e2e/app.ts`): this test WRITES — three hooks, a
 * snapshot, seen lines and four audit records — and the shared fixture is
 * persistent and read by a shrink-only parity ledger next door. A temporary
 * workspace per run is `e2e/live-stream.spec.ts`'s own arrangement, taken
 * here for the same reason and with the same `removeTree` on the way out.
 *
 * Nothing in the fixture is fabricated. The items are created through the
 * CLI, the injections are the SessionStart hook's own, the snapshot is
 * `PreCompact`'s and the compaction is `SessionStart(source: 'compact')`
 * followed by `PostCompact` — the true order, which is the order that
 * decides what the records say (`hooks/post-compact.ts` · `fires FIRST and` ·
 * ~39).
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';

const REPO = path.resolve(import.meta.dirname, '..');
const HOOKS = path.join(REPO, 'src', 'hooks');

/** The one session everything below is about. */
const SESSION = 'preview-compact-continuity-session';
/** The `continuity` item — the tier whose delivered state is what flips. */
const CONTINUITY_ITEM = 'RULE-this-rule-survives-a-compaction';
/**
 * A second, PINNED item, and it is not decoration.
 *
 * `/api/sessions` picks the page's session from the LEDGER
 * (`Ledger.recentSessions(1)[0]`), and the ledger stores three tiers only —
 * `pinned`, `jit`, `restored` (`core/audit.ts` · `const LEDGER_TIERS = new
 * Set` · ~1150). A corpus whose only delivery was `continuity` projects NO
 * ledger row, so `/api/sessions` answers `default: null`, the shell lands on
 * `cold`, and `/api/select?cold=1` reads no seen file at all — every
 * continuity item due forever and nothing to flip. Measured before this file
 * was written; the guard below is what keeps a future reader from
 * rediscovering it as a mysterious green.
 */
const PINNED_ITEM = 'RULE-pinned-so-this-session-reaches-the-ledger';

/**
 * Feed a hook its payload on stdin, exactly as Claude Code does — the same
 * shape `scripts/demo-corpus.ts` uses to build the demo corpus from the real
 * entry points. `execFileSync` THROWS on a non-zero exit, which is right
 * here: a compaction that did not happen must fail this test loudly rather
 * than leave it asserting that nothing changed.
 */
function hook(script: string, payload: Record<string, unknown>, cwd: string): void {
  execFileSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', path.join(HOOKS, script)],
    { cwd, input: JSON.stringify(payload), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
}

/** `runCli`, with the command named in the failure rather than a bare exit code. */
function cli(args: string[], cwd: string): void {
  expect(runCli(args, cwd, () => {}), `fixture command failed: mycontext ${args.join(' ')}`)
    .toBe(0);
}

interface Fixture {
  page: Page;
  /** The WORKSPACE — the directory the hooks and the server are pointed at. */
  workspace: string;
}

/**
 * A corpus with one continuity item and one session that has already started,
 * both projections built, a server over it, and the app open on its landing
 * screen — which is `preview` (`app.js` · `Object.hasOwn(SCREENS, asked) ?
 * asked : 'preview'` · ~1590), reached without a navigation because the
 * opening hash is the nonce and not a route.
 */
async function previewing(page: Page, body: (fixture: Fixture) => Promise<void>): Promise<void> {
  const workspace = mkdtempSync(path.join(tmpdir(), 'myctx-preview-compact-'));
  let harness: UiHarness | undefined;
  try {
    cli(['init'], workspace);
    cli(['add', 'rule', 'this rule survives a compaction',
      '--body', 'Whatever else is dropped, this is delivered again after every compaction.',
      '--yes'], workspace);
    cli(['edit', CONTINUITY_ITEM, '--continuity', '--yes'], workspace);
    cli(['add', 'rule', 'pinned so this session reaches the ledger',
      '--body', 'Injected at every session start, which is what projects a ledger row.',
      '--yes'], workspace);
    cli(['pin', PINNED_ITEM, '--yes'], workspace);

    // The session start this preview is ABOUT: it delivers the continuity
    // item and writes the seen line marked with the session-wide window, so
    // the tier reads as already delivered until a compaction rebuilds it.
    hook('session-start.ts', {
      session_id: SESSION, hook_event_name: 'SessionStart', source: 'startup', cwd: workspace,
    }, workspace);

    // Both projections, because they answer different questions and this test
    // needs both. `audit` builds the audit projection — without it eighteen of
    // the twenty-one screens render "the audit projection is behind relative
    // to its log" (`e2e/app.ts`'s own note). `audit replay-ledger` builds the
    // LEDGER, which is what `/api/sessions` reads for the default session; it
    // is a different projection and `scripts/demo-corpus.ts` had to learn the
    // same lesson (`demo-corpus.ts` · `The LEDGER projection, which is a
    // different projection and was never` · ~854).
    cli(['audit'], workspace);
    cli(['audit', 'replay-ledger'], workspace);

    harness = await startUiChild(workspace);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(
      page.locator('.nav').first(),
      'the app never rendered a rail button — it probably has no token',
    ).toBeVisible({ timeout: 15_000 });
    await body({ page, workspace });
  } finally {
    if (harness !== undefined) await harness.stop();
    removeTree(workspace);
  }
}

test('a compaction, with the Injection preview open: the continuity lane changes without a reload', async ({ page }) => {
  // Three node child processes for the compaction plus two for the fixture,
  // each paying Node's type-stripping start-up on Windows. The default 30s
  // budget is spent before the page is even open.
  test.setTimeout(180_000);

  await previewing(page, async ({ page: p, workspace }) => {
    // ── The preconditions, each asserted rather than assumed ──────────────

    // 1. The page is on the SESSION, not on `cold`. `cold=1` reads no seen
    //    file, so every continuity item is due forever and this test would
    //    pass by measuring nothing. See PINNED_ITEM above for how that state
    //    is actually reached.
    await expect(
      p.locator('#sesslbl'),
      'the shell landed on a session other than the fixture\'s — with no session there is no '
      + 'seen file, so the continuity tier has no dedupe state and nothing to flip',
    ).toHaveText(SESSION, { timeout: 15_000 });

    // 2. The budget ribbon is drawn, and the continuity lane is one lane.
    //    `.chip.carry` is the continuity tier's own chip class
    //    (`screens/parts.js`'s `TIERCHIP`), so this finds the lane by what it
    //    IS rather than by its position among five fixed tracks.
    const ribbons = p.locator('#ribbons');
    await expect(ribbons, 'the budget ribbon never rendered').toBeVisible({ timeout: 15_000 });
    const continuityLane = ribbons.locator('.ribbon').filter({ has: p.locator('.chip.carry') });
    await expect(continuityLane, 'expected exactly one continuity lane on the ribbon')
      .toHaveCount(1);
    // `${used} / ${budget} · ${inCount} in · ${outCount} out` — the lane's own
    // counts. Matched as a fragment, not as a whole string: the token figures
    // are a real measurement and may legitimately move, and what this test is
    // about is the IN count, which is categorical.
    const continuityCounts = continuityLane.locator('.rlabel .n');

    // 3. THE STATE BEFORE. The tier was delivered at the session start, so
    //    within this window it is deduped: nothing in, and no row in
    //    Delivered.
    await expect(
      continuityCounts,
      'the continuity tier is due before any compaction — the fixture\'s session start did not '
      + 'write its seen line, so there is no "already delivered" state to be rebuilt',
    ).toHaveText(/·\s*0 in\s*·/);
    await expect(
      p.locator(`#deliveredRows [data-id="${CONTINUITY_ITEM}"]`),
      'the continuity item is already in Delivered before the compaction',
    ).toHaveCount(0);

    // 4. Not a permanent banner: nothing has arrived, so nothing is offered.
    await expect(
      p.locator('#screenstale'), 'the affordance is visible with nothing pending',
    ).toBeHidden();

    // 5. **The no-reload sentinel.** Set on the live document; a reload or a
    //    navigation destroys it. Asserted at the end, so "without a reload"
    //    is a measurement rather than a claim about what this test did not
    //    type.
    await p.evaluate(() => { document.body.setAttribute('data-not-reloaded', 'yes'); });

    // ── THE COMPACTION — the real one, in the real order ──────────────────
    //
    // `PreCompact` writes the restore snapshot whose `capturedAt` IS the new
    // continuity window; `SessionStart(source: 'compact')` performs the
    // delivery and appends the continuity seen line marked with it;
    // `PostCompact` records that the compaction completed. Four audit
    // records: `hook`/`pre-compact`, `injection`/`compact-restore`,
    // `hook`/`post-compact` — the kinds this screen's row omitted, which is
    // the whole defect.
    hook('pre-compact.ts', {
      session_id: SESSION, hook_event_name: 'PreCompact', trigger: 'auto', cwd: workspace,
    }, workspace);
    hook('session-start.ts', {
      session_id: SESSION, hook_event_name: 'SessionStart', source: 'compact', cwd: workspace,
    }, workspace);
    hook('post-compact.ts', {
      session_id: SESSION, hook_event_name: 'PostCompact', trigger: 'auto',
      compact_summary: 'the conversation so far, compacted', cwd: workspace,
    }, workspace);

    // ── WHAT THE SCREEN DOES ABOUT IT ────────────────────────────────────

    // `preview` declares `refresh: 'ask'` and that is unchanged by this task:
    // the screen holds reader state a silent rebuild would discard, so the
    // owner is OFFERED the refresh. This is the assertion that fails on the
    // old declaration — four records, none of them a kind the row named, and
    // a screen that hears nothing.
    await expect(
      p.locator('#screenstale'),
      'a compaction fired with the Injection preview open and the screen was never told. '
      + 'The four moments that change what this screen shows write kinds `injection` and '
      + '`hook`; if SCREEN_INVALIDATION.preview does not declare both, nothing on this page '
      + 'moves without a hand reload — which is exactly the owner\'s report.',
    ).toBeVisible({ timeout: 30_000 });

    // Nothing has redrawn yet — an `ask` screen waits to be pressed, and the
    // lane still shows the pre-compaction answer.
    await expect(continuityCounts).toHaveText(/·\s*0 in\s*·/);

    // Take it. This calls the screen's own `render()` in place, which refetches
    // `/api/select` and `/api/simulate` — and both resolve the seen file and the
    // restore snapshot from disk per request, so what comes back is the state
    // the compaction actually left, not a replay of the frames that announced
    // it.
    //
    // That the affordance HIDES itself once pressed is deliberately not
    // asserted here: `e2e/live-refresh.spec.ts` already owns that property
    // ("never a permanent banner"), and re-asserting it in this file would add
    // a second timing surface — the compaction writes four records and any one
    // of them may still be in flight when the take lands — to a test whose
    // subject is whether the screen HEARD the compaction at all.
    await p.locator('#screenstale button').click();

    // ── THE ACCEPTANCE CASE ──────────────────────────────────────────────
    //
    // The window was rebuilt, so the continuity guarantee is due again. The
    // lane flips from "this tier delivered nothing" to "this tier delivers",
    // and the item appears in Delivered. Both are the same fact, read off the
    // two places the screen draws it.
    await expect(
      continuityLane.locator('.rlabel .n'),
      'the screen redrew and the continuity lane still shows the PRE-compaction answer: it '
      + 'says the tier is already delivered into a context window that no longer exists',
    ).toHaveText(/·\s*1 in\s*·/, { timeout: 15_000 });
    await expect(
      p.locator(`#deliveredRows [data-id="${CONTINUITY_ITEM}"]`),
      'the continuity item is not in Delivered after the compaction — the screen and the '
      + 'ribbon disagree about the same selection',
    ).toHaveCount(1);

    // WITHOUT A RELOAD, asserted. The sentinel was set on the document before
    // the compaction and is still there, so everything above happened on the
    // page the owner already had open.
    await expect(
      p.locator('body'),
      'the document was replaced somewhere in this test — whatever else it proved, it did '
      + 'not prove that the screen updates without a reload',
    ).toHaveAttribute('data-not-reloaded', 'yes');
  });
});
