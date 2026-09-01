import { test, expect } from './app.ts';

/**
 * **EVERY FIELD THE STRIP DRAWS IS A PILL, HAS A HOVER, AND IS ONE HEIGHT.**
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * The owner found SEVEN separate gaps by looking at the bar over one session —
 * a field still rendering as bare text, a hover that was missing while its
 * neighbour had one, pills at three different heights. Each was reported,
 * fixed, and followed by another of the same kind, because each fix was
 * applied to the field that had been POINTED AT rather than to the set.
 *
 * That is the difference between a list and a rule, and this file is the rule.
 * It enumerates what the strip actually draws — from the DOM, in every state
 * the fixtures reach — and asserts three properties of all of them at once. A
 * field added next month is born a pill with a hover, or this fails by name.
 *
 * ── WHAT IT ASSERTS, AND WHY THESE THREE ───────────────────────────────────
 *
 *  1. **Every field is a pill.** Owner ruling: nothing on the bar is bare text.
 *  2. **Every field has a non-empty `title`, covering the WHOLE pill.** A
 *     reader who hovers the LABEL and gets nothing while the value answers
 *     reads the feature as broken, so the title is checked on the field
 *     element itself rather than on some descendant of it.
 *  3. **Every pill is the same height.** They shared every box property and
 *     differed only in an inherited `line-height`, which produced 24, 26 and
 *     28px pills side by side.
 *
 * ── AND THE SET IS DERIVED, NEVER LISTED ───────────────────────────────────
 *
 * A hand-kept list of fields inside this file would be the very thing it
 * exists to replace — it would go stale the moment a field was added, silently,
 * which is this project's most repeated defect. The set comes from `[data-f]`
 * in the rendered strip. The FLOOR below is what stops a selector that has
 * stopped matching from turning all three assertions into vacuous truths.
 */
const SAMPLE = (used: number, size: number, pct: number) => ({
  receivedAt: new Date().toISOString(), model: 'Claude', version: '1.0.0',
  context: { state: 'known', usedTokens: used, windowSize: size, percent: pct },
});
const body = (pct: number, five: number, seven: number) => ({
  session: 's', sample: SAMPLE(Math.round(pct * 10_000), 1_000_000, pct),
  mycontext: { tokens: 264_500, injections: 3, unrecorded: 0 }, mycontextError: null,
  handover: { verdict: 'not-asked', path: null, askedAt: null, writtenAt: null, thresholdPercent: 85 },
  rateLimits: {
    fiveHour: { usedPercent: five, resetsAt: Math.floor(Date.now() / 1000) + 7_200 },
    sevenDay: { usedPercent: seven, resetsAt: Math.floor(Date.now() / 1000) + 140_000 },
  },
  costUsd: 3742.3, warmPercent: 99.9, elapsedMs: 5_040_000,
  sessionName: 'my-context V2.0.0', focus: 'plan:walk', focusRead: true,
  modes: { effort: 'high', thinking: true, fastMode: null, exceeds200k: true },
  lastAudit: { row: { op: 'subagent-stop', at: new Date().toISOString() } },
});

test('every field the strip draws is a pill, has a hover, and is one height', async ({ app }) => {
  const { page } = app;
  const seen = new Map<string, { pill: boolean; title: boolean; h: number }>();

  // Four states, so a field that only appears at one level is still reached.
  for (const [pct, five, seven] of [[45, 5, 59], [65, 5, 59], [75, 72, 59], [88, 72, 95]] as const) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route('**/api/watch/context*', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(body(pct, five, seven)),
    }));
    await page.setViewportSize({ width: 2273, height: 900 });
    await page.reload();
    await page.waitForTimeout(600);

    const found = await page.evaluate(() => {
      const out: { f: string; text: string; pill: boolean; title: boolean; h: number }[] = [];
      for (const el of document.querySelectorAll('.strip [data-f]')) {
        const e = el as HTMLElement;
        const text = (e.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (text === '') continue;
        // A field nested inside another field is one pill, not two.
        if (e.parentElement?.closest('[data-f]') !== null) continue;
        const cs = getComputedStyle(e);
        out.push({
          f: e.dataset.f ?? '?', text,
          // Bordered, whatever class carries it.
          pill: cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none',
          // On the FIELD, so hovering the label answers as well as the value.
          title: (e.getAttribute('title') ?? '').trim() !== '',
          h: Math.round(e.getBoundingClientRect().height),
        });
      }
      return out;
    });
    for (const f of found) {
      const prev = seen.get(f.f);
      seen.set(f.f, {
        pill: (prev?.pill ?? true) && f.pill,
        title: (prev?.title ?? true) && f.title,
        h: f.h,
      });
    }
  }

  // ── THE VACUITY FLOOR. Every set contains the empty set, so a selector that
  // stopped matching would make all three assertions below pass while checking
  // nothing at all — silently, and for as long as nobody looked.
  expect(seen.size, 'the strip declared too few fields for this to be reading it')
    .toBeGreaterThanOrEqual(10);

  const bare = [...seen].filter(([, v]) => !v.pill).map(([f]) => f);
  expect(bare, 'these strip fields are not bordered pills').toEqual([]);

  const mute = [...seen].filter(([, v]) => !v.title).map(([f]) => f);
  expect(mute, 'these strip fields carry no hover on the field itself').toEqual([]);

  const heights = [...new Set([...seen.values()].map((v) => v.h))].sort((a, b) => a - b);
  expect(heights, `pills came out at ${heights.join('/')}px — they must be one height`)
    .toHaveLength(1);
});
