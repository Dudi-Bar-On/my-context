/**
 * **The split over REAL injections, driven in a browser** —
 * `TASK-the-already-in-context-split-only-appears-under-a-hand`.
 *
 * `e2e/injected-empty.spec.ts` already drives `Injected now`'s `lines` table.
 * This file drives the fourth fact the same screen now carries beside it:
 * `InjectedBody.spills`, ALREADY IN CONTEXT / GENUINELY ABSENT over ids
 * `AuditRecord.spilled` recorded a REAL injection actually dropping, joined
 * against what this session's seen file and continuity window hold right now.
 *
 * ── WHY THIS IS NOT THE SIMULATOR'S SPLIT, MEASURED AGAIN ──────────────────
 *
 * `screens/simulate.js` already draws this exact vocabulary — ALREADY IN
 * CONTEXT, GENUINELY ABSENT — for a HYPOTHETICAL run under whatever budget a
 * reader is dragging. Measured in a browser on this repository's own corpus
 * the day that split shipped, it never showed in either state a reader
 * actually opens: cold answered 91 spills that were all trivially absent, warm
 * answered zero spills at all. This file is not a second measurement of that
 * split; it measures a DIFFERENT one, over `.demo-corpus`'s real, already-
 * recorded audit history, on the two sessions `injected-empty.spec.ts` already
 * establishes the shape of.
 *
 * ── WHY `.demo-corpus` ACTUALLY HAS SOMETHING TO SHOW ───────────────────────
 *
 * Measured directly against `.demo-corpus/.my_context` before this file was
 * written: every numbered `demo-session-a3f9c1-N` carries 113-116 real spilled
 * ids across its own injection history (`kind: 'injection'` records with a
 * non-empty `spilled` array). That is real pressure from a real fixture, not a
 * budget dragged to 1 to force the shape — the fixture already produces the
 * case the simulator's split could never reach.
 *
 * ── MOUNTED, FOR THE SAME REASON `injected-empty.spec.ts` MOUNTS ───────────
 *
 * The shell has no session picker (`ctx.session()` is always the fixed
 * default), so a screen whose whole subject is *which session* can only be
 * driven by mounting the module directly, the way that file's own header
 * explains. The API is read through the SAME probe, `window.myctx.api`, so
 * what a test compares the DOM against is what the credentialed door the
 * screen itself uses actually returned — never a number typed in this file by
 * hand.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/** The session `scripts/demo-corpus.ts` drives through a full working day. */
const LONG = 'demo-session-a3f9c1-11';
/** The session `scripts/demo-corpus.ts` replays `/clear` on — its seen file is gone. */
const CLEARED = 'demo-session-a3f9c1-20';
/** No fixture ever wrote this id anywhere — the true "nothing to report" case. */
const NEVER = 'e2e-never-injected-into';

interface SpillsBody {
  lines: unknown[];
  spills: {
    alreadyInContext: { id: string; tier: string }[];
    genuinelyAbsent: { id: string; tier: string }[];
    error: string | null;
  };
}

/** `InjectedBody`, read through the SAME credentialed door the screen calls. */
async function fetchInjected(page: Page, session: string): Promise<SpillsBody> {
  return page.evaluate(async (id) => {
    // @ts-expect-error — the plain-JS screen contract, as `injected-empty.spec.ts` reaches it.
    const ctx = window.myctx as { api: (p: string) => Promise<unknown> };
    return ctx.api(`/api/session/${encodeURIComponent(id)}/injected`) as Promise<SpillsBody>;
  }, session);
}

/**
 * Mount `screens/injected.js` for one session inside a probe card in the
 * visible `#/injected` section — the same construction
 * `injected-empty.spec.ts`'s `mountFor` uses, and for the same reason: only
 * `session()` and `onSessionChange()` are overridden, so every ancestor rule
 * that decides whether a sentence can be SEEN (router, stylesheet, shell) is
 * the real one.
 */
async function mountFor(page: Page, session: string): Promise<string> {
  await page.evaluate(() => { location.hash = '#/injected'; });
  await page.locator('section[data-p="injected"] .card.pane')
    .waitFor({ state: 'attached', timeout: 20_000 });
  await page.evaluate(async (id) => {
    const load = (specifier: string): Promise<Record<string, unknown>> => import(specifier);
    const screen = await load('/screens/injected.js') as unknown as
      { render: (root: Element, ctx: unknown) => Promise<void> };
    // @ts-expect-error — the plain-JS screen contract, as above.
    const shell = window.myctx as Record<string, unknown>;
    const scene = document.querySelector('section[data-p="injected"]')!;
    document.getElementById('spillprobe')?.remove();
    const probe = document.createElement('div');
    probe.id = 'spillprobe';
    scene.prepend(probe);
    await screen.render(probe, {
      ...shell,
      session: () => id,
      onSessionChange: () => () => {},
    });
  }, session);
  await expect(page.locator('#spillprobe'),
    'the mounted screen was wiped by the shell\'s own render').toBeAttached();
  return '#spillprobe';
}

/* ══ 1 · A REAL SESSION WITH BOTH HALVES OF THE SPLIT ══════════════════════ */

test('a session with real spill history draws ALREADY IN CONTEXT and GENUINELY ABSENT, matching the API', async ({ app }) => {
  const measured = await fetchInjected(app.page, LONG);
  // Non-vacuity, first: the fixture must actually exercise both halves, or
  // this test would pass on a screen that draws nothing.
  expect(measured.spills.error, 'the fixture\'s audit projection must be fresh').toBeNull();
  expect(measured.spills.alreadyInContext.length,
    `${LONG} must have at least one spilled id this session's own seen file already holds — `
    + 'if this is 0, the demo corpus no longer produces the case this test measures').toBeGreaterThan(0);
  expect(measured.spills.genuinelyAbsent.length,
    `${LONG} must have at least one spilled id still absent from this session's window`)
    .toBeGreaterThan(0);

  const root = await mountFor(app.page, LONG);
  const probe = app.page.locator(root);

  // No unmeasured chip: this is a real answer, not a refusal.
  await expect(probe.locator('span.chip.unmeas')).toHaveCount(0);

  // `{b:ALREADY IN CONTEXT}` is its own `<b>` inside the sentence's `<p>`, so
  // the count that follows it lives in a SIBLING text node — the paragraph is
  // the unit that carries both, and `getByText` on the bold run alone would
  // never see the `({n})` beside it.
  const held = probe.locator('p', { hasText: 'ALREADY IN CONTEXT' });
  await expect(held, 'the fixture measured a non-zero already-held count above').toBeVisible();
  await expect(held).toContainText(`(${measured.spills.alreadyInContext.length})`);

  const absent = probe.locator('p', { hasText: 'GENUINELY ABSENT' });
  await expect(absent, 'the fixture measured a non-zero absent count above').toBeVisible();
  await expect(absent).toContainText(`(${measured.spills.genuinelyAbsent.length})`);

  // One of the actually-absent ids really appears in the sentence — not just
  // a count, but the id a reader would act on.
  const sampleId = measured.spills.genuinelyAbsent[0]!.id;
  await expect(absent).toContainText(sampleId);
});

/* ══ 2 · A CLEARED WINDOW STILL SHOWS ITS REAL HISTORY ══════════════════════
 *
 * `injected-empty.spec.ts` already measures that `CLEARED`'s `lines` table is
 * empty — the seen file went with the window. `.audit/` did not: this is the
 * asymmetry `InjectedBody.spills`' own doc names, and the point of hosting the
 * split on THIS screen rather than nowhere is that a reader sees both facts on
 * one page rather than being told "nothing was injected" by the table above
 * while the real history sits unread beside it.
 */

test('a cleared window keeps its real spill history even though the seen-file table is empty', async ({ app }) => {
  const measured = await fetchInjected(app.page, CLEARED);
  expect(measured.lines.length, 'non-vacuity: the seen-file table really is empty here').toBe(0);
  expect(measured.spills.error).toBeNull();
  expect(measured.spills.genuinelyAbsent.length,
    `${CLEARED} must still carry real spilled ids in its audit history — if this is 0, the ` +
    'case this test measures (a destroyed window with a live audit trail) is gone from the fixture')
    .toBeGreaterThan(0);

  const root = await mountFor(app.page, CLEARED);
  const probe = app.page.locator(root);

  // The seen-file table really is bare, matching the other spec's own measurement.
  await expect(probe.locator('tbody tr')).toHaveCount(0);
  // And the real-injection split is NOT bare — it is a measured, non-zero
  // GENUINELY ABSENT, drawn from a store `/clear` does not touch.
  await expect(probe.locator('span.chip.unmeas')).toHaveCount(0);
  const absent = probe.locator('p', { hasText: 'GENUINELY ABSENT' });
  await expect(absent).toBeVisible();
  await expect(absent).toContainText(`(${measured.spills.genuinelyAbsent.length})`);
});

/* ══ 3 · A MEASURED ZERO IS DRAWN AND NAMED, NEVER LEFT BLANK ═══════════════
 *
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`. A session
 * the audit log has never once mentioned is a true, measured zero — the
 * projection answered, and the answer is nothing — and it must read as a
 * positive sentence, not as an absent section.
 */

test('a session the audit log never mentions draws a measured zero, not a blank', async ({ app }) => {
  const measured = await fetchInjected(app.page, NEVER);
  expect(measured.spills.error, 'a session absent from the log is still a MEASURED answer').toBeNull();
  expect(measured.spills.alreadyInContext.length).toBe(0);
  expect(measured.spills.genuinelyAbsent.length).toBe(0);

  const root = await mountFor(app.page, NEVER);
  const probe = app.page.locator(root);

  await expect(probe.locator('span.chip.unmeas')).toHaveCount(0);
  await expect(probe.getByText('ALREADY IN CONTEXT')).toHaveCount(0);
  await expect(probe.getByText('GENUINELY ABSENT')).toHaveCount(0);
  // THE SENTENCE. Not a blank section — a stated zero.
  const zero = probe.locator('p.small', { hasText: 'spilled nothing' });
  await expect(zero, 'a measured zero must be a sentence, never a silent absence').toBeVisible();
  const height = await zero.evaluate((el) => el.getBoundingClientRect().height);
  expect(height, 'the sentence must occupy a real box, not just exist in the DOM').toBeGreaterThan(0);
});
