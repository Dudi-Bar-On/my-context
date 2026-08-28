/**
 * **The status strip, driven — every segment the design of record declares.**
 *
 * On 2026-08-28 the mockup's strip carried 44 elements in 5 colours and the
 * app's carried 4 in 1, and the gap had gone a month without being measured
 * because nothing looked. `plan:walk seq:29b` asks for exactly this file:
 * "a browser test drives the strip and asserts the segment count against the
 * mockup's own, so the next divergence is caught rather than measured a month
 * later".
 *
 * **The unit is a STRING KEY, not an element count, and that is not a
 * weakening.** The mockup declares every state of the git group and the
 * context group at once and hides all but one, because it is a demo you click
 * to cycle; the app renders the ONE state it measured and cannot render the
 * others without inventing the values they interpolate — `t()` throws on a
 * missing substitution, which is the correct behaviour and the reason a
 * hidden `strip.branch` with no branch cannot exist here. Counting elements
 * would therefore compare a page showing seven git states against a page
 * showing one and fail for a reason that is not a defect.
 *
 * So the app tags every keyed segment it draws with `data-k`, this file drives
 * it through the states, and the union of what it drew is compared with what
 * the mockup declares. That is strictly stronger than a count: a count cannot
 * tell you WHICH segment went missing, and this names it.
 *
 * **Derived from the mockup's own bytes**, like `declared()` and
 * `declaredMonospace()` in `mockup.ts` and for the reason those are derived —
 * "a test that remembers a number fails for the wrong reason the next time a
 * screen gains a label". A segment added to the design of record fails here
 * until the app draws it, which is the direction `DEC-the-app-is-what-is-built
 * -the-mockup-is-history-and-a-gap` keeps: the mockup's second job is a list
 * of intended features not yet implemented, and a gap nobody is forced to look
 * at is a gap that rots.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';
import { MOCKUP_PATH, MOCKUP_URL } from './mockup.ts';

/**
 * Every `data-t` key the design of record's `<footer class="strip">` declares,
 * MINUS the mockup's own demo controls.
 *
 * The exclusion is STRUCTURAL rather than a name list: the reduced-transparency
 * checkbox lives inside `.noprint`, which is how this design already marks
 * "chrome that is not part of the product being drawn". A second demo control
 * added the same way is excluded the same way, with no edit here.
 */
function declaredStripKeys(): Set<string> {
  const html = readFileSync(MOCKUP_PATH, 'utf8');
  const open = html.indexOf('<footer class="strip">');
  const close = html.indexOf('</footer>', open);
  expect(open, 'the design of record must declare a footer.strip').toBeGreaterThan(-1);
  expect(close, 'the strip footer must be closed').toBeGreaterThan(open);
  let block = html.slice(open, close);
  const demo = block.indexOf('class="small noprint"');
  if (demo !== -1) block = block.slice(0, demo);
  return new Set([...block.matchAll(/\sdata-t="([^"]+)"/g)].map((m) => m[1]!));
}

/**
 * **The ledger of what the strip declares and does not draw — one entry, and
 * it shrinks.**
 *
 * `strip.meas` is the "measured" chip that sits beside the audit append p95
 * when there IS a p95. There is not one: no endpoint on this read surface
 * exposes an aggregate over the audit log, and the mockup's `0.55 ms` is a
 * benchmark figure out of `core/audit-db.ts`'s header rather than something
 * this server measures. The app draws `strip.unmeasured` in its place — the
 * segment is present and NAMED as unmeasured, per
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`, rather than
 * dropped — so this chip becomes reachable on the day that aggregate lands,
 * and this entry is deleted with the same commit.
 *
 * Nothing else in the strip is in here. If a second entry ever seems necessary,
 * the question to answer first is whether the segment has a source, because
 * `plan:port seq:6` assumed two segments shared one blocker and there were
 * forty with several.
 */
const NOT_DRAWN_YET = new Set(['strip.meas']);

interface Scenario {
  readonly name: string;
  readonly git?: unknown;
  readonly items?: number;
  /** `null` fulfils nothing and lets the real endpoint answer. */
  readonly context?: unknown;
  readonly sessions?: unknown;
  /** Endpoints that are made to fail, by path fragment. */
  readonly fail?: readonly string[];
}

const KNOWN_SAMPLE = (state: string, used: number | null, size: number | null, pct: number | null) => ({
  receivedAt: new Date().toISOString(),
  model: 'Claude', version: '1.0.0',
  context: { state, usedTokens: used, windowSize: size, percent: pct },
});

/**
 * The states, chosen to reach every key exactly once between them rather than
 * to be exhaustive twice over — eight boots is already eight boots.
 */
const SCENARIOS: readonly Scenario[] = [
  {
    name: 'on a branch, in sync, context known, project-knowledge whole',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 43,
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
      mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
    },
  },
  {
    name: 'differs from upstream, project-knowledge partial',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'differs' },
    items: 0,
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
      mycontext: { tokens: 6200, injections: 3, unrecorded: 1 }, mycontextError: null,
    },
  },
  {
    name: 'no upstream, project-knowledge unavailable',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'no-upstream' },
    items: 1,
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
      mycontext: null, mycontextError: 'the audit log could not be read',
    },
  },
  {
    name: 'local tip unreadable, context not yet known',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'unknown' },
    items: 2,
    context: {
      session: 's', sample: KNOWN_SAMPLE('not-yet-known', null, 200000, null),
      mycontext: null, mycontextError: 'no projection',
    },
  },
  {
    name: 'detached HEAD, context unknown to this build',
    git: { detached: true, branch: null, commit: '7f3a91c9d2', upstream: 'unknown' },
    items: 3,
    context: {
      session: 's', sample: KNOWN_SAMPLE('unknown', null, null, null),
      mycontext: null, mycontextError: 'no projection',
    },
  },
  {
    name: 'not a git repository, and no status-line bridge sampled',
    git: null,
    items: 4,
    context: { session: 's', sample: null, mycontext: null, mycontextError: 'no projection' },
  },
  {
    name: 'a cold session has no live context number',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 5,
    sessions: { sessions: [], default: null },
  },
  {
    name: 'every endpoint the strip asks refuses to answer',
    fail: ['/api/meta', '/api/status', '/api/watch/context'],
  },
];

async function boot(page: Page, s: Scenario): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  for (const fragment of s.fail ?? []) {
    await page.route(`**${fragment}*`, (route) => route.fulfill({
      status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'refused by the test' }),
    }));
  }
  if (s.git !== undefined) {
    await page.route('**/api/meta*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.2', git: s.git, staleCode: false }),
    }));
  }
  if (s.items !== undefined) {
    await page.route('**/api/status*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        version: '1.0.2', profile: 'default',
        items: { total: s.items, byCategory: {}, byStatus: {}, byOrigin: {} },
        reviewQueue: { drafts: 0, always: 0, globalLayerDrafts: 0 },
        pendingRevisions: { items: 0, fields: 0 },
        health: { errors: 0, warnings: 0, infos: 0 },
      }),
    }));
  }
  if (s.context !== undefined) {
    await page.route('**/api/watch/context*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(s.context),
    }));
  }
  if (s.sessions !== undefined) {
    await page.route('**/api/sessions*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(s.sessions),
    }));
  }
  await page.reload();
  // The strip's four provenance groups are built synchronously by
  // `renderChrome()`; the segments inside them arrive with their fetches. Wait
  // for the last one to land rather than for `load`, which fires while every
  // group is still empty.
  await expect(page.locator('#strip .slab')).toHaveCount(4);
  await expect(page.locator('#ctx [data-k]').first()).toBeVisible();
  await expect(page.locator('#gitstate [data-k]').first()).toBeVisible();
}

/** Every `data-k` the strip is currently drawing. */
function drawn(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll('#strip [data-k]')]
    .map((el) => (el as HTMLElement).dataset['k'] ?? ''));
}

test('the strip draws every segment the design of record declares', async ({ app }) => {
  const { page } = app;
  const declared = declaredStripKeys();
  expect(declared.size, 'the mockup must declare strip keys — an empty set would make this vacuous')
    .toBeGreaterThan(15);

  const seen = new Set<string>();
  for (const scenario of SCENARIOS) {
    await boot(page, scenario);
    const keys = await drawn(page);
    expect(keys.length, `${scenario.name}: the strip drew no keyed segment at all`).toBeGreaterThan(0);
    for (const k of keys) seen.add(k);
  }

  const missing = [...declared].filter((k) => !seen.has(k) && !NOT_DRAWN_YET.has(k)).sort();
  expect(missing,
    'the design of record declares these strip segments and the app never drew one of them, in '
    + 'any of the states this file drives. Either draw it, or add it to NOT_DRAWN_YET with the '
    + 'reason it has no source — the ledger shrinks, it does not grow by default.').toEqual([]);

  // The other direction, so the ledger cannot rot: an entry that IS drawn is
  // an entry that should have been deleted.
  const stale = [...NOT_DRAWN_YET].filter((k) => seen.has(k)).sort();
  expect(stale, 'NOT_DRAWN_YET names a segment the app now draws — delete the entry').toEqual([]);
});

test('every provenance group is told apart by a WORD as well as by a colour', async ({ app }) => {
  const { page } = app;
  const groups = await page.evaluate(() => [...document.querySelectorAll('#strip .slab')]
    .map((el) => ({ text: (el.textContent ?? '').trim(), colour: getComputedStyle(el).color })));

  expect(groups, 'the strip must carry the four provenance groups').toHaveLength(4);
  // Colour, because the owner asked for it: "use colors to diffrentiate
  // between properties".
  expect(new Set(groups.map((g) => g.colour)).size,
    'four provenance groups, four colours — a bar whose whole job is provenance rendered in one '
    + 'colour makes a reader parse a sentence to learn what a glance should say').toBe(4);
  // AND a word, because colour alone is not a channel. --gold and --ok measure
  // 1.04:1 against each other: the same state to a dichromat, identical grey on
  // a monochrome printer, and one system tone under forced-colors. This is the
  // assertion that survives all three.
  expect(new Set(groups.map((g) => g.text)).size,
    'four provenance groups, four distinct labels — 06-a11y.html: "a glyph AND a colour AND a '
    + 'name in the accessible string"').toBe(4);
  for (const g of groups) expect(g.text, 'a group label may not be empty').not.toBe('');
});

test('the four group colours survive forced-colors as words, not as hues', async ({ app }) => {
  const { page } = app;
  await page.emulateMedia({ forcedColors: 'active' });
  const words = await page.evaluate(() => [...document.querySelectorAll('#strip .slab')]
    .map((el) => (el.textContent ?? '').trim()));
  await page.emulateMedia({ forcedColors: 'none' });
  expect(new Set(words).size,
    'forced-colors replaces every colour in the page with a system tone, so a bar differentiated '
    + 'by colour ALONE becomes one colour. The words are what is left, and there must be four of '
    + 'them.').toBe(4);
});

test('an unmeasured segment says so, and offers the call again', async ({ app }) => {
  const { page } = app;
  await boot(page, SCENARIOS[SCENARIOS.length - 1]!);

  // The defect this replaces: both catch blocks left their span EMPTY, with no
  // retry, so one transient failure blanked the segment permanently — which is
  // what the owner saw as a status line that "is not constantly showing".
  for (const sel of ['#gitstate', '#stripitems', '#ctx']) {
    const text = ((await page.locator(sel).textContent()) ?? '').trim();
    expect(text, `${sel} went blank. A blank is indistinguishable from a failure to load, and a `
      + 'reader who cannot tell those apart stops trusting the surface '
      + '(STD-a-measured-zero-is-drawn-and-named, clause 3).').not.toBe('');
    expect(await page.locator(`${sel} [data-k="strip.unread"]`).count(),
      `${sel} must NAME its state rather than merely not being empty`).toBe(1);
    expect(await page.locator(`${sel} button`).count(),
      `${sel} must offer the call again — an unmeasured state with no way back is the permanent `
      + 'blank wearing a label').toBeGreaterThan(0);
  }

  // And the two figures that have no source at all are named as unmeasured
  // rather than dropped — including their LABELS, so the property the reader
  // is owed is on screen even while its number is not.
  const audit = ((await page.locator('#auditstate').textContent()) ?? '');
  expect(audit, 'the audit group must still name both properties').toContain('injections');
  expect(await page.locator('#auditstate [data-k="strip.unmeasured"]').count()).toBe(1);
});

test('the strip renders at its own type step, and the app matches the design of record', async ({ page }) => {
  // The design of record first — this is the surface the size was changed on.
  await page.goto(MOCKUP_URL);
  const mockup = await page.evaluate(() => {
    const el = document.querySelector('.strip');
    if (el === null) return null;
    const cs = getComputedStyle(el);
    const mono = document.querySelector('.strip .m');
    return {
      strip: cs.fontSize,
      token: getComputedStyle(document.documentElement).getPropertyValue('--fs-strip').trim(),
      mono: mono === null ? null : getComputedStyle(mono).fontSize,
    };
  });
  expect(mockup, 'the mockup must draw a .strip').not.toBeNull();
  expect(mockup!.token, 'the strip has its own type token, so a prose repaint cannot move it')
    .toBe('14px');
  // BOTH SIDES OF THE SAME REQUIREMENT, pinned as a range rather than as one
  // number, because the owner said both halves of it a day apart: "the font
  // should be bigger to be readable" at 13px, and then "maybe also the status
  // lines font is too big and setting it a little bit smaller will allow more
  // details to be presented" at 15px. Readable AND dense. 14px is the value
  // that sits between them, chosen only AFTER the two changes that recovered
  // the space — the no-bridge sentence cut to three words, and the provenance
  // row filled — so it is not a size compensating for crowding that has since
  // been removed.
  expect(parseFloat(mockup!.strip),
    'the strip may not go back to the 13px the owner could not read, and a prose token is how it '
    + 'would: --fs-0 IS 13px, which is what the strip used to point at').toBeGreaterThan(13);
  expect(parseFloat(mockup!.strip),
    'nor may it climb back to the size the owner called too big for the detail it has to carry')
    .toBeLessThan(15);
  expect(parseFloat(mockup!.mono ?? '0'),
    'a monospace run in the strip must not fall back under the old size through `.m`\'s .87em')
    .toBeGreaterThanOrEqual(13);
});

test('the app draws the strip at exactly the size the design of record does', async ({ app }) => {
  const { page } = app;
  const shipped = await page.evaluate(() => ({
    strip: getComputedStyle(document.querySelector('#strip')!).fontSize,
    token: getComputedStyle(document.documentElement).getPropertyValue('--fs-strip').trim(),
  }));
  const declaredToken = /--fs-strip:([^;]+);/.exec(readFileSync(MOCKUP_PATH, 'utf8'))?.[1]?.trim();
  expect(declaredToken, 'the mockup must declare --fs-strip').toBe('14px');
  expect(shipped.token, 'styles.css and the mockup carry one token, held byte-identical by '
    + 'test/ui/styles-parity.test.ts — this is the rendered half of that').toBe(declaredToken);
  expect(shipped.strip, 'the strip must render at its own token, not at the prose step').toBe('14px');
});

/**
 * **The row is tall enough for what it holds, and what it holds is centred in
 * it.** Owner, 2026-08-29: "the status line occures too low at the bottom,
 * increase its height a little."
 *
 * Measured before anything moved, because "too low" has two readings and only
 * one of them is a height. At 30px the content was already vertically CENTRED —
 * the group label's ink box sat 7px from the top of the row and 7px from the
 * bottom — so this was not a baseline fault, and a taller row would have been
 * the wrong answer if it had been. What the same measurement showed is that the
 * tallest element in the row was 31px inside a 30px row: the retry button and
 * the chips had no clearance at all and one already spilled a pixel past the
 * bottom edge of the window. Centred content with nothing around it is what
 * reads as jammed against the bottom.
 *
 * Both halves are asserted, so a later change cannot fix one by breaking the
 * other: a row that grows while the content drifts off centre fails here, and
 * so does a row that centres content it has no room for.
 */
test('the strip is tall enough for its controls and centres them in the row', async ({ app }) => {
  const m = await app.page.evaluate(() => {
    const strip = document.getElementById('strip')!;
    const box = strip.getBoundingClientRect();
    const kids = [...strip.querySelectorAll('*')]
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.height > 0 && b.width > 0);
    const label = document.querySelector('#strip .slab')!;
    const range = document.createRange();
    range.selectNodeContents(label);
    const ink = range.getBoundingClientRect();
    return {
      height: Math.round(box.height),
      tallest: Math.round(Math.max(...kids.map((b) => b.height))),
      inkTop: Math.round(ink.top - box.top),
      inkBottom: Math.round(box.bottom - ink.bottom),
      bottom: Math.round(box.bottom),
      viewport: window.innerHeight,
    };
  });

  expect(m.height, 'the strip row is 38px — the shell grid\'s fourth row').toBe(38);
  expect(m.bottom, 'the strip ends at the bottom edge of the window, as the grid puts it')
    .toBe(m.viewport);
  expect(m.height - m.tallest,
    'the tallest thing in the strip is a chip or the retry button. At 30px that measured 31px in '
    + 'a 30px row — no clearance, and a pixel of it outside the window. There must be room around '
    + 'it, or a centred row still reads as jammed against the bottom.').toBeGreaterThanOrEqual(6);
  // OPTICALLY centred, which is not geometrically centred. `align-items:center`
  // centres the LINE BOX, and a line box is not symmetrical about its ink: the
  // descender hangs below the baseline, so geometric centring leaves the
  // visible text sitting low with its descenders nearest the clipping edge.
  // The text must therefore sit AT or ABOVE the middle, with the leftover room
  // under it — "the text should be moved up a little", measured rather than
  // eyeballed.
  expect(m.inkTop, 'the text must not sit BELOW optical centre — that is the "too low at the '
    + 'bottom" the owner reported, and a taller row alone only adds space above it')
    .toBeLessThanOrEqual(m.inkBottom);
  expect(m.inkBottom - m.inkTop, 'moved up a LITTLE: an over-correction is the same fault '
    + 'upside down').toBeLessThanOrEqual(4);
});

/**
 * **The text is INSIDE its container — measured on the text, not on the row.**
 *
 * This is the assertion that distinguishes "the row is tall enough" from "the
 * glyphs are in it", and only the second is what a reader sees. It was missing:
 * `app-layout.spec.ts` asserts every shell row is occupied and that no
 * perspective element exceeds the viewport, and both of those pass while a
 * descender is being shaved off the bottom of the strip.
 *
 * The two `overflow:hidden` boxes are the ones that can actually cut — the
 * context sentence and the audit property names, where the hidden overflow is
 * what makes the ellipsis work and clips vertically as a side effect. Measured
 * at three viewport heights, because "in a full screen it appears a little bit
 * cut" is a claim about one size and has to be answered at several.
 */
test('no text in the strip is clipped by the box it sits in, at any window height', async ({ app }) => {
  const { page } = app;
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1024, height: 640 }]) {
    await page.setViewportSize(size);
    const cut = await page.evaluate(() => {
      const strip = document.getElementById('strip')!;
      const box = strip.getBoundingClientRect();
      const bad: string[] = [];
      const walk = (el: Element): void => {
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '') {
            const range = document.createRange();
            range.selectNodeContents(child);
            const ink = range.getBoundingClientRect();
            if (ink.height === 0) continue;
            const where = `"${(child.textContent ?? '').trim().slice(0, 24)}"`;
            // Inside the strip itself…
            if (ink.top < box.top || ink.bottom > box.bottom) {
              bad.push(`${where} outside the strip by ${Math.max(box.top - ink.top, ink.bottom - box.bottom).toFixed(1)}px`);
            }
            // …and inside every ancestor that would clip it.
            for (let a: HTMLElement | null = child.parentElement; a !== null && strip.contains(a); a = a.parentElement) {
              if (getComputedStyle(a).overflowY === 'visible') continue;
              const ab = a.getBoundingClientRect();
              if (ink.top < ab.top || ink.bottom > ab.bottom) {
                bad.push(`${where} clipped by ${a.tagName}.${a.className} by ${Math.max(ab.top - ink.top, ink.bottom - ab.bottom).toFixed(1)}px`);
              }
            }
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            walk(child as Element);
          }
        }
      };
      walk(strip);
      return bad;
    });
    expect(cut, `at ${size.width}x${size.height}: a run of text in the status strip is being cut `
      + 'by the box around it. The row height, the line-height of the two ellipsising boxes and '
      + 'the strip\'s own bottom padding are the three things that decide this — see the status '
      + 'strip rule in styles.css for what each of them was measured at.').toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
});

/**
 * **No group collapses, and the bar does not spill.**
 *
 * The strip has more to say than a 1280px window holds, so something has to
 * give, and WHICH thing gives is a decision rather than an accident. Owner,
 * 2026-08-29: "it includes a very long text that are not so important and other
 * more important info could not be seen like the context size left filled
 * percentage". So the audit group — two figures this read surface has no source
 * for — yields three times as fast as the context group, which carries the live
 * measurement this product is about.
 *
 * Both ends of that are asserted, because both have been wrong in a browser
 * during this task: with the audit group at `flex:none` the context sentence
 * measured ZERO px, and with it unfloored the audit group did. A group at zero
 * is the four-of-forty-four defect wearing a flexbox — the property is gone and
 * the reader is back to not knowing it exists.
 */
test('every provenance group keeps a width, and the strip never spills', async ({ app }) => {
  const { page } = app;
  for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 640 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    const m = await page.evaluate(() => {
      const strip = document.getElementById('strip')!;
      return {
        groups: [...strip.querySelectorAll('.sgrp')].map((el) => ({
          name: (el as HTMLElement).className,
          width: Math.round(el.getBoundingClientRect().width),
        })),
        spill: strip.scrollWidth - strip.clientWidth,
      };
    });
    expect(m.groups.length, `${size.width}px: four provenance groups`).toBe(4);
    for (const g of m.groups) {
      expect(g.width, `${size.width}px: ${g.name} collapsed to nothing. A group squeezed to zero `
        + 'has removed the property from the strip as surely as never building it').toBeGreaterThan(20);
    }
    expect(m.spill, `${size.width}px: the strip is wider than the window it sits in, so its tail `
      + '— the live-stream fault and the screen-refresh affordance — is off-screen').toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
});

/**
 * **Every CONTROL in the strip sits inside the strip — the same property as
 * the text one element along, which is why it is measured the same way.**
 *
 * Owner, 2026-08-29: "the refresh button when occures is displayed cutted at
 * the bottom ... on top of the refresh button apears New activity for this
 * screen." Measured: `#screenstale` was 49px tall in a 38px row, its top 5.8px
 * above the strip and its bottom 4.8px past the bottom edge of the WINDOW — the
 * strip's bottom is the viewport's bottom, so an overhang there is a clip.
 *
 * The cause was neither the row height nor the font: `app.js` builds the
 * affordance as a plain `<span>` holding a message and a `button.icon`, and
 * `.icon` is `display:grid` — a block. A block child inside a blockified flex
 * item takes its own line, so the message stacked ON TOP of the button. It has
 * been that way since the affordance was built, and at the old 30px row it
 * overhung by 8px more, so the taller strip did not cause it and had in fact
 * been reducing it. Neither element has a rule in the design of record, which
 * is how a control ships with no layout of its own.
 *
 * The two affordances are hidden until something happens, so this UNHIDES them:
 * a control that is only wrong when it appears is a control no passing test
 * ever looks at, which is the whole reason this was found by a person.
 */
test('every control in the strip sits inside the strip, at any window height', async ({ app }) => {
  const { page } = app;
  for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 640 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    const over = await page.evaluate(() => {
      // Both are built hidden and shown by events this test cannot raise on
      // demand. Showing them by hand measures the layout, which is the thing
      // under test; what raises them is `live-refresh.spec.ts`'s business.
      for (const id of ['livesep', 'livestate', 'screenstalesep', 'screenstale']) {
        (document.getElementById(id) as HTMLElement).hidden = false;
      }
      const live = document.getElementById('livestate')!;
      if ((live.textContent ?? '') === '') live.textContent = 'the live stream ended';
      const strip = document.getElementById('strip')!;
      const box = strip.getBoundingClientRect();
      const bad: string[] = [];
      for (const el of strip.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.height === 0 && r.width === 0) continue;
        const above = box.top - r.top;
        const below = r.bottom - box.bottom;
        if (above > 0.5 || below > 0.5) {
          bad.push(`${el.tagName.toLowerCase()}#${(el as HTMLElement).id}.${(el as HTMLElement).className}`
            + ` overhangs by ${Math.max(above, below).toFixed(1)}px (height ${r.height.toFixed(1)} in a ${box.height}px row)`);
        }
      }
      // Put them back, so nothing after this test inherits a state the page
      // never actually reached.
      for (const id of ['livesep', 'livestate', 'screenstalesep', 'screenstale']) {
        (document.getElementById(id) as HTMLElement).hidden = true;
      }
      return bad;
    });
    expect(over, `at ${size.width}x${size.height}: something in the status strip is taller than `
      + 'the row it sits in. The strip is the last grid row, so its bottom IS the bottom of the '
      + 'window — an overhang there is not an overhang, it is a clip, and the reader sees a '
      + 'control with its bottom sliced off.').toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
});
