/**
 * **A page boot writes ZERO `ui-refused` records. Counted, not looked for.**
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 *
 * `plan:walk seq:85`. Measured 2026-08-29 in a real browser against
 * `.demo-corpus`: every boot that did not already hold an in-memory token
 * fired the shell's whole opening set — `/api/meta`, `/api/status`,
 * `/api/watch/volume`, `/api/watch/stream`, `/api/sessions`, then the landing
 * screen's `/api/status`, `/api/coverage`, `/api/select`, `/api/simulate`,
 * `/api/items` — and had every one of them refused. **A refusal is the read
 * surface's one WRITE**: `recordRefusal` → `recordAudit` →
 * `keepProjectionCurrent`, a `BEGIN IMMEDIATE` transaction. Ten reads became
 * ten writes, of nothing but failures, and all ten were repeated the instant a
 * nonce was pasted.
 *
 *     .demo-corpus   5,207 of 6,156 audit records
 *     LIVE corpus      899 — 17% of the owner's whole audit history
 *
 * ── WHY IT COUNTS RECORDS AND NOT PIXELS OR STRINGS ────────────────────────
 *
 * Because the thing that was wrong is a NUMBER OF WRITES, and every cheaper
 * proxy for it passes on a machine that was merely fast enough. A test that
 * greps the page for `database is locked` measures whether a sibling worker
 * happened to be mid-commit; a test that asserts the page renders measures
 * that the refusals were survived, which they always were. This project has
 * caught "a proxy instead of the property" six times — most recently a
 * settle-counter that went negative and inverted its own wait — so the
 * assertion is the count of `ui-refused` rows the log gained, and nothing
 * else.
 *
 * ── HOW A COUNT STAYS HONEST UNDER FOUR WORKERS ────────────────────────────
 *
 * Two filters, and BOTH are needed. The second was missing on the first
 * writing of this file and made it flaky in exactly the way a count must not
 * be.
 *
 * **By port**, because every refusal record carries the submitted `Host`,
 * which for this server is `127.0.0.1:<its own port>` (`security.ts`'s
 * `recordRefusal`, reached only after the gate has validated the Host is
 * exactly that). A sibling worker booting its own page on its own port
 * therefore cannot move this number, which a bare delta over the one shared
 * append-only log could not promise.
 *
 * **And as a DELTA taken inside the test**, because a port number is unique
 * only while it is BOUND. `.demo-corpus`'s log is permanent and holds
 * thousands of rows from earlier runs, and the OS hands the same ephemeral
 * ports out again: a server that draws a port some earlier run also drew
 * inherits that run's refusals and reads as a boot that refused itself
 * fourteen times. Measured, on the `chrome` project, on the first run of this
 * file. So every test here starts its OWN server and takes its baseline BEFORE
 * the navigation — which is why none of them uses the `app` fixture, whose
 * boot has already happened by the time a test body could look at anything.
 *
 * ── AND IT IS NOT VACUOUSLY ZERO ───────────────────────────────────────────
 *
 * The last test provokes a refusal that is a genuine security event — a wrong
 * token — and requires the counter to see exactly it. Without that half, a
 * counter that always answered 0, or a filter that matched nothing, would read
 * as a perfect fix. **Removing self-inflicted refusals is not removing the
 * audit of real ones**, and this is where that stays true.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnUiChild, startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { startOnSafePort } from '../test/ui/unsafe-ports.ts';
import { CORPUS } from './app.ts';
import { settleScreen } from './settle.ts';

const AUDIT_LOG = path.join(CORPUS, '.my_context', '.audit', 'audit.jsonl');

interface RefusalRow {
  readonly check: string;
  readonly status: number;
  readonly route: string;
}

/**
 * Every `ui-refused` record this server refused, in log order.
 *
 * A torn tail is skipped rather than thrown on: the file is appended to by
 * live processes while this reads it, and the last line can be half-written.
 * A record that does not parse is not a refusal this test can attribute, and
 * failing a run over one would be a failure about nothing this file claims.
 */
function refusalsFrom(port: number): RefusalRow[] {
  const rows: RefusalRow[] = [];
  for (const line of readFileSync(AUDIT_LOG, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    let record: { op?: string; refusal?: RefusalRow & { host?: string | null } };
    try {
      record = JSON.parse(line) as typeof record;
    } catch {
      continue;
    }
    if (record.op !== 'ui-refused' || record.refusal === undefined) continue;
    if (record.refusal.host !== `127.0.0.1:${port}`) continue;
    rows.push({
      check: record.refusal.check, status: record.refusal.status, route: record.refusal.route,
    });
  }
  return rows;
}

/** What the count is FOR: a message naming the routes, not merely a number. */
function describe(rows: RefusalRow[]): string {
  return rows.map((r) => `${r.status} ${r.check} ${r.route}`).join(', ');
}

/**
 * The boot is finished when the landing screen has finished drawing and no
 * `/api` read is still open — `settleScreen`'s own three facts. A fixed wait
 * here would measure the clock, and a `waitForSelector` on the rail would
 * measure static markup that is drawn before the first request is even made.
 */
async function bootSettled(page: Page): Promise<void> {
  const settled = await settleScreen(page, 'preview');
  expect(settled.settled,
    `the landing screen never settled (${settled.inFlight} reads still open, ${settled.count} `
    + 'nodes) — the refusal count below would be a measurement of a half-finished boot')
    .toBe(true);
}

/**
 * A server of this test's own, stopped whatever happens.
 *
 * `startUiChild` mints and PRINTS a nonce and redeems nothing, so the page
 * performs the handoff itself — the path a person takes, and the only one that
 * exercises what this file measures. `'none'` spawns the same server and never
 * spends its nonce, with `startOnSafePort` applied by hand for the reason
 * `nocred-notice.spec.ts` gives: a port Chrome refuses kills the navigation
 * with nothing said about what was being measured.
 */
async function withServer(
  redeem: 'nonce' | 'none', run: (h: UiHarness) => Promise<void>,
): Promise<void> {
  let harness: UiHarness | undefined;
  try {
    harness = redeem === 'nonce'
      ? await startUiChild(CORPUS)
      : await startOnSafePort(() => spawnUiChild(CORPUS, ['--port', '0']));
    await run(harness);
  } finally {
    if (harness !== undefined) await harness.stop();
  }
}

test('a boot through the real handoff writes no ui-refused record at all', async ({ page }) => {
  await withServer('nonce', async (h) => {
    // BEFORE the navigation. See the header: a recycled port carries an older
    // run's rows, and a bare count would charge them to this boot.
    const before = refusalsFrom(h.port).length;

    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(page.locator('.nav').first(), 'the app never rendered a rail button')
      .toBeVisible({ timeout: 15_000 });
    await bootSettled(page);

    const rows = refusalsFrom(h.port).slice(before);
    expect(rows.length,
      `the credentialled boot refused ${rows.length} of its own requests: ${describe(rows)}`)
      .toBe(0);
  });
});

/**
 * **The boot that HAS no credential — the one that wrote ten.**
 *
 * A bookmarked bare address, a second tab in a browser that never redeemed
 * anything, a tab whose server has been replaced. The nonce is never spent, so
 * the page arrives holding nothing at all.
 *
 * Zero is asserted TOGETHER with the page having actually booted. A page that
 * failed to load would also refuse nothing, and the two must not be able to
 * look alike.
 */
test('a boot holding no credential writes no ui-refused record either', async ({ page }) => {
  await withServer('none', async (h) => {
    const before = refusalsFrom(h.port).length;

    await page.goto(`http://127.0.0.1:${h.port}/`);
    await expect(page.locator('.nav').first(), 'no credential: the rail never drew')
      .toBeVisible({ timeout: 15_000 });
    await bootSettled(page);

    const rows = refusalsFrom(h.port).slice(before);
    expect(rows.length,
      `a boot with nothing to present refused itself ${rows.length} times: ${describe(rows)}. `
      + "The gate's answer to a request carrying no token and no cookie is fixed before the "
      + 'socket opens; sending it anyway buys one BEGIN IMMEDIATE write per read')
      .toBe(0);

    // And it booted, rather than being quiet because it was broken. The rail
    // above is static markup; this is the router having run and the shell
    // having said which state it is in.
    await expect(page.locator('[data-p]').first(),
      'no credential: the router never created a screen section, so the zero above measures a '
      + 'page that did not boot rather than a boot that did not refuse itself')
      .toBeAttached();
    await expect(page.locator('p.small.spill').first(),
      'no credential: the page went quiet WITHOUT saying it has no credential — silence is the '
      + 'defect KNOWN-the-bare-server-url-renders-the-whole-app-and-never-says-it names')
      .toBeVisible({ timeout: 15_000 });
  });
});

/**
 * **The counter can count, and a real refusal still lands.**
 *
 * The anti-vacuity half, and the boundary this change had to hold: a wrong
 * token is a SECURITY event and must still be recorded. What was removed is
 * the app refusing its own boot, not the audit of anything a caller actually
 * did.
 *
 * Through `fetch` from inside the page rather than through `ctx.api`,
 * deliberately: `app.js` now declines to send a request it knows carries no
 * credential, and this must exercise the SERVER's gate, not the page's.
 */
test('a refusal that is a real security event is still recorded — exactly one', async ({ page }) => {
  await withServer('nonce', async (h) => {
    const before = refusalsFrom(h.port).length;

    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(page.locator('.nav').first()).toBeVisible({ timeout: 15_000 });
    await bootSettled(page);
    expect(refusalsFrom(h.port).length - before, 'the boot was supposed to leave the log alone')
      .toBe(0);

    const status = await page.evaluate(async () => {
      const response = await fetch('/api/status', {
        headers: { 'X-Mycontext-Token': 'deadbeefdeadbeefdeadbeefdeadbeef' },
      });
      return response.status;
    });
    expect(status, 'a wrong token must still be refused by the gate').toBe(403);

    await expect
      .poll(() => refusalsFrom(h.port).length - before, {
        message: 'a wrong token was refused on the wire and never reached the audit log — the '
          + 'boot fix removed the app refusing itself, and it must not have removed the record '
          + 'of a caller presenting a credential this server never issued',
        timeout: 10_000,
      })
      .toBe(1);

    expect(refusalsFrom(h.port).slice(before), 'the recorded refusal is not the one that happened')
      .toEqual([{ check: 'token-mismatch', status: 403, route: '/api/status' }]);
  });
});
