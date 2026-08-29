/**
 * **The status strip joins the live-refresh mechanism** — measured the only
 * way it can be: a record lands on disk, the shell's one stream carries it,
 * `CHROME_INVALIDATION` decides which GROUP of the strip it makes stale, and
 * that group's number changes with nothing reloaded.
 *
 * Owner, 2026-08-29: *"the refresh mechanism you already implemented should
 * include also the status line."* The strip shows an item count, a git state,
 * a context fullness and — one row up, same chrome — how the audit projection
 * stood; all of them move while a person works, and until this task nothing
 * told the strip so. `renderChrome()` built it once, `fillChrome()` filled it
 * once at boot, and its only recovery was the per-segment Refresh control
 * added for `strip.unread`.
 *
 * ── WHY A BROWSER TEST AND NOT A LINE IN `test/ui/live-invalidation.test.ts`
 *
 * The same reason `e2e/preview-compact-continuity.spec.ts` gives, restated
 * because it applies here word for word: that file is the gate that holds the
 * declaration to `AUDIT_KINDS`, and **a row carrying the wrong kinds is
 * perfectly well formed**. A test asserting the table now has five more keys
 * would restate the change without ever exercising it. The subject here is
 * the wiring end to end.
 *
 * ── THE TWO PROPERTIES, AND WHY BOTH ARE NEEDED ──────────────────────────
 *
 * "The strip refreshes" is only half of what was asked for. The other half is
 * the bound: *do not refetch what has not changed* — the strip's segments have
 * different sources, and a blanket re-fill on every mutation would make the
 * git group flicker for an item write, over a fact no audit record can move.
 * So each test drives ONE record and asserts a segment that must move AND a
 * request that must not be made:
 *
 *   1. a `mutation` (a real `mycontext add`) moves the CORPUS group's count,
 *      and `/api/meta` — the git group's only source — is never asked again.
 *   2. an `access` record — a kind no other group declares — makes the
 *      PROVENANCE bar ask again, and `/api/status` is never asked, because
 *      nothing about an item changed. (Why that one is an ASK rather than a
 *      flipped sentence is on the test itself.)
 *
 * Counting requests is what makes the second half a measurement rather than a
 * claim: asserting that a segment's TEXT is unchanged proves nothing, since
 * refetching an unchanged fact produces identical text.
 *
 * **Request listeners are attached before `goto`**, for the reason
 * `e2e/live-stream.spec.ts` records at length: the shell issues its chrome
 * requests during the initial load, so a listener attached in the test body is
 * racing them, and a count read after that race is "did my listener win".
 *
 * ── ITS OWN CORPUS ───────────────────────────────────────────────────────
 *
 * Not `.demo-corpus` (`e2e/app.ts`): these tests WRITE — an item and an audit
 * record — and the shared fixture is persistent and read by a shrink-only
 * parity ledger next door. A temporary workspace per run is
 * `e2e/live-stream.spec.ts`'s own arrangement, taken here for the same reason
 * and with the same `removeTree` on the way out.
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
import { DIR_NAME } from '../src/core/workspace.ts';

/** How many items the fixture creates, and therefore what the strip must say. */
const FIXTURE_ITEMS = 2;

interface Fixture {
  page: Page;
  /** The directory the CLI is pointed at — the repo, not `.my_context`. */
  dir: string;
  /** `<dir>/.my_context`, which is what `recordAudit` takes. */
  corpus: string;
  /** Every `/api` path the page has requested, in order, since before `goto`. */
  requests: string[];
}

/** `runCli`, with the command named in the failure rather than a bare exit code. */
function cli(args: string[], cwd: string): void {
  expect(runCli(args, cwd, () => {}), `fixture command failed: mycontext ${args.join(' ')}`)
    .toBe(0);
}

/** How many times the page has asked for `route` so far. */
function asked(requests: string[], route: string): number {
  return requests.filter((url) => new URL(url).pathname === route).length;
}

/**
 * A corpus of two items with its audit projection built, a server over it, and
 * the app open — on whatever screen it lands on, because the strip is chrome
 * and the point is that it does not depend on which screen that is.
 */
async function stripped(page: Page, body: (fixture: Fixture) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-strip-live-'));
  const corpus = path.join(dir, DIR_NAME);
  // Attached BEFORE `goto` — see the header. `/api/meta` and `/api/status` are
  // both requested during the initial load, which is exactly the window a
  // listener attached in the test body would miss.
  const requests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/')) requests.push(req.url());
  });
  let harness: UiHarness | undefined;
  try {
    cli(['init'], dir);
    cli(['add', 'rule', 'the first item the strip counts',
      '--body', 'Two items exist before anything in this test runs.', '--yes'], dir);
    cli(['add', 'rule', 'the second item the strip counts',
      '--body', 'The count on the strip is a measurement, so it starts at a known number.',
      '--yes'], dir);
    // Without this the projection is ABSENT rather than fresh, and the
    // provenance bar's answer would start at `prov.projAbsent` — a state that
    // an appended record does not move, so test 2 would measure nothing.
    cli(['audit'], dir);

    harness = await startUiChild(dir);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(
      page.locator('.nav').first(),
      'the app never rendered a rail button — it probably has no token',
    ).toBeVisible({ timeout: 15_000 });
    await body({ page, dir, corpus, requests });
  } finally {
    if (harness !== undefined) await harness.stop();
    removeTree(dir);
  }
}

test('an item is created with the app open: the strip\'s count moves, and the git group is not refetched', async ({ page }) => {
  // A CLI run plus a server child, each paying Node's type-stripping start-up
  // on Windows, before the page is even open.
  test.setTimeout(120_000);

  await stripped(page, async ({ page: p, dir, requests }) => {
    // ── THE STATE BEFORE, asserted rather than assumed ────────────────────

    // The count segment's own value span. `.m` is the monospace figure;
    // `[data-k="strip.items"]` beside it is the word. Read separately so the
    // assertion is about the NUMBER and not about the label's wording.
    const count = p.locator('#stripitems .m');
    await expect(
      count, 'the strip never drew an item count at all',
    ).toHaveText(String(FIXTURE_ITEMS), { timeout: 15_000 });

    // The git group drew something — which is what makes "and it was not
    // refetched" a statement about a segment that is actually saying
    // something, rather than about an empty span.
    await expect(p.locator('#gitstate'), 'the git group is blank').not.toBeEmpty();
    const metaBefore = asked(requests, '/api/meta');
    expect(
      metaBefore, 'the strip never asked /api/meta, so this test cannot measure not asking again',
    ).toBeGreaterThan(0);

    // **The no-reload sentinel.** Set on the live document; a reload or a
    // navigation destroys it. Asserted at the end, so "without a reload" is a
    // measurement rather than a claim about what this test did not type.
    await p.evaluate(() => { document.body.setAttribute('data-not-reloaded', 'yes'); });

    // ── THE MUTATION — a real one, through the real entry point ───────────
    //
    // `mycontext add` writes the Markdown, the index row AND the audit
    // record, so what reaches the stream is the record the product itself
    // writes rather than one this test forged into the log.
    cli(['add', 'rule', 'a third item, created while the page was open',
      '--body', 'Created after the page loaded, so the count on the strip is now stale.',
      '--yes'], dir);

    // ── WHAT THE STRIP DOES ABOUT IT ─────────────────────────────────────
    //
    // `corpus` declares `refresh: 'auto'` — the strip holds no reader state a
    // rebuild could discard, so it just updates. This is the assertion that
    // fails without a chrome declaration at all: the shell would hear the
    // record on its one stream, no chrome subscriber would want it, and the
    // count would sit at 2 until somebody reloaded.
    await expect(
      count,
      'an item was created with the page open and the status strip never noticed. The strip is '
      + 'chrome rather than a screen, so it is CHROME_INVALIDATION that has to declare `mutation` '
      + 'for the corpus group and app.js that has to subscribe on its behalf.',
    ).toHaveText(String(FIXTURE_ITEMS + 1), { timeout: 30_000 });

    // ── AND THE BOUND: NOTHING THE RECORD DID NOT MOVE WAS REFETCHED ──────
    //
    // Git state is moved by committing, checking out and fetching, and no op
    // in `AUDIT_OPS` records any of them — so `repo` declares `[]` and never
    // subscribes. A wholesale re-fill would have asked `/api/meta` again here
    // and made the branch chip flicker for an item write.
    expect(
      asked(requests, '/api/meta'),
      'an item write refetched /api/meta. The git group has no live source — nothing in the '
      + 'audit log can move a branch — so a refill of it is a wasted request and a flicker.',
    ).toBe(metaBefore);

    await expect(
      p.locator('body'),
      'the document was replaced somewhere in this test — whatever else it proved, it did not '
      + 'prove that the strip updates without a reload',
    ).toHaveAttribute('data-not-reloaded', 'yes');
  });
});

/**
 * **The provenance bar hears a kind no other segment does — and the count
 * does not hear it back.**
 *
 * The bar is `'*'` because a record is the ONLY moment `projectionState` can
 * change and the frame cannot say whether it did: `recordAudit` calls
 * `keepProjectionCurrent` in the same call, so the ORDINARY case leaves the
 * projection current and the bar's sentence identical — while the cases that
 * do move it (upkeep returning `unbuilt`, `foreign`, `diverged` or `failed`,
 * none of which it repairs) look exactly the same from the browser.
 *
 * **So what is asserted here is the ASK, not a flipped sentence.** That is
 * deliberate and it is not a weaker test of a weaker property: a bar that does
 * not ask again cannot ever report an upkeep that silently failed, which is
 * the entire reason the bar exists. Making a sentence flip would mean forcing
 * the projection into a damaged state from outside the product's own doors,
 * and a test that has to break the workspace to see the feature is measuring
 * the break. The visible-change half of this task is
 * `e2e/preview-compact-continuity.spec.ts`'s shape and is the test above, on
 * the count.
 *
 * The bound in the other direction IS the strong half here: nothing about an
 * item changed, so `/api/status` must not be asked at all.
 */
test('a record of a kind only the provenance bar reads: the bar asks again, the count does not', async ({ page }) => {
  test.setTimeout(120_000);

  await stripped(page, async ({ page: p, corpus, requests }) => {
    // ── THE STATE BEFORE ─────────────────────────────────────────────────
    //
    // The fixture ran `mycontext audit`, so the projection is current with its
    // log and the bar says so by key. Matched on `data-k` rather than on the
    // sentence, which is what the string table owns.
    await expect(
      p.locator('#provproj [data-k="prov.projFresh"]'),
      'the provenance bar does not report a fresh projection, so there is no baseline here',
    ).toBeVisible({ timeout: 15_000 });

    const count = p.locator('#stripitems .m');
    await expect(count).toHaveText(String(FIXTURE_ITEMS), { timeout: 15_000 });
    const statusBefore = asked(requests, '/api/status');
    expect(
      statusBefore,
      'the strip never asked /api/status, so this test cannot measure not asking again',
    ).toBeGreaterThan(0);
    const volumeBefore = asked(requests, '/api/watch/volume');
    expect(
      volumeBefore, 'the provenance bar never asked /api/watch/volume at boot',
    ).toBeGreaterThan(0);

    await p.evaluate(() => { document.body.setAttribute('data-not-reloaded', 'yes'); });

    // ── ONE RECORD, OF A KIND NO OTHER STRIP SEGMENT READS ────────────────
    //
    // `access`/`ui-refused` is a request this server's gate refused. No group
    // in CHROME_INVALIDATION names that kind: the corpus group wants
    // `mutation`, the session group wants `injection`, and the other two want
    // nothing. Only `prov`'s `'*'` hears it — which is the point. Appended
    // through `recordAudit`, the same door every hook and every mutation uses,
    // so this is a real line in the real log and not a fabricated frame.
    recordAudit(corpus, { kind: 'access', op: 'ui-refused' });

    await expect
      .poll(() => asked(requests, '/api/watch/volume'), {
        message: 'a record was appended to the audit log with the page open and the provenance '
          + 'bar never asked how the projection stood. That bar reports the one state a reader '
          + 'cannot otherwise discover — an upkeep that declined and repaired nothing — and a '
          + 'bar that only ever asks at boot can never report it.',
        timeout: 30_000,
      })
      .toBeGreaterThan(volumeBefore);

    // The refill drew a state, not a blank. `#provproj` carries the label and
    // the state, both keyed; `STD-a-measured-zero-is-drawn-and-named-an
    // -unmeasured-thing-is` is what a refill that cleared first and repainted
    // late would have broken, on the segment a reader watches for exactly
    // this kind of fact.
    await expect(
      p.locator('#provproj [data-k]'),
      'the provenance bar refilled and came back with fewer keyed parts than it had — a refill '
      + 'must never leave a named state blank',
    ).toHaveCount(2);

    // ── AND THE BOUND: NOTHING THE RECORD DID NOT MOVE WAS REFETCHED ──────
    //
    // Not one item changed, so the count cannot have. A `corpus` row that
    // named `'*'` — or one shared row for the whole strip — would have asked
    // `/api/status` again here, walking the store and re-running every doctor
    // check, to redraw the same number.
    expect(
      asked(requests, '/api/status'),
      'a refused-request record refetched /api/status. The corpus group reads `items.total`, '
      + 'which only a `mutation` moves; refilling it for every kind is the blanket re-fill this '
      + 'per-group declaration exists to avoid.',
    ).toBe(statusBefore);
    await expect(count, 'the count changed for a record that created no item').toHaveText(
      String(FIXTURE_ITEMS),
    );

    await expect(
      p.locator('body'),
      'the document was replaced somewhere in this test — whatever else it proved, it did not '
      + 'prove that the strip updates without a reload',
    ).toHaveAttribute('data-not-reloaded', 'yes');
  });
});
