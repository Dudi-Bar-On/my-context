// @basis TASK-a-collapsed-table-ruling-is-painted-in-two-colours-and-43-of,
// REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a,
// DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn
/**
 * **THE THREE CONTROLS `plan:archive seq:39`/`41` BUILT WITHOUT A STYLESHEET.**
 *
 * `TASK-a-collapsed-table-ruling-is-painted-in-two-colours-and-43-of` carries
 * the list. Those lanes shipped the collapsed fold line, the lane roster and
 * the roster's child rows on nights when `styles.css` was held by another lane,
 * and each left a note naming the rule it could not write. This file measures
 * the rules now that they exist — and it exists as a separate file from
 * `e2e/conversations.spec.ts` for the reason that file's own siblings give: its
 * 66 tests drive whether these controls WORK, and a failure here should name
 * the dress rather than the behaviour.
 *
 * ── WHAT IS MEASURED, AND WHY EACH IS WORTH A NUMBER ──────────────────────
 *
 * **`.tvlanes` wears the link face.** `seq:41`'s roster control — "2 helper
 * agents" in the document's head — shipped wearing `.tvjump`, the class Top,
 * End, "N new below" and the three copy buttons wear. `.tvjump`'s mono bordered
 * box means "move inside THIS document": every control that wears it leaves the
 * reader where they are. The roster is a ROUTE CHANGE to a different surface
 * with a different Back, so wearing that face told the reader the opposite of
 * what pressing it does. `e2e/lane-link-face.spec.ts` made this argument for
 * `.tvlane` and `.tvlanehome` and is not extended here, because that file's
 * subject is `seq:31`; this is the third wearer joining its two selector lists.
 *
 * **The roster's indent comes from the sheet.** `drawLaneRow` carried
 * `LANE_INDENT_PX = 18` and wrote a `padding-inline-start` at runtime, because
 * the sheet was held. What is left in JS is the DEPTH — an integer off the
 * data, which no stylesheet can hold — and the step and the relation hairline
 * are declarations now. Both halves are measured: the property JS writes, and
 * the pixel the sheet paints from it.
 *
 * **`.tvquiet` gets `--sp-1` and a dimmed marker.** Two declarations, and the
 * third the lane asked for is deliberately absent — `quietLine` ships
 * `details.tvthink.tvquiet`, so `.tvthink>summary` already dresses the summary
 * and a `.tvquiet>summary` copy of those same three declarations would be a
 * second copy of the rule directly above it in the file.
 *
 * ── HOW `.tvquiet` IS MEASURED, SAID PLAINLY BECAUSE IT IS UNUSUAL ────────
 *
 * The real control needs a machinery run holding records that carry nothing but
 * their own indexes, and `e2e/conversations.spec.ts`' "a fold counts its empty
 * records on one line, and that line opens" already builds exactly that and
 * drives it in both languages. Rebuilding that fixture here to re-assert its
 * existence would be a second copy of a test, which is this project's own named
 * defect. So this file appends the control's OWN MARKUP to the live archive
 * document and reads what the cascade resolves for it. That measures the two
 * declarations and nothing else — it is not evidence that the control is built,
 * and the test says so in its name.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { projectDirName } from '../src/core/conversation-index.ts';

const LANE_CALL = 'toolu_LANE';
const DEEP_CALL = 'toolu_DEEP';
const BRIEF = 'read the index and report';

function session(): unknown[] {
  const at = (n: number): string => new Date(Date.UTC(2026, 8, 9, 6, 0, n)).toISOString();
  return [
    { type: 'ai-title', aiTitle: 'A session that dispatched two lanes' },
    {
      type: 'user',
      message: { role: 'user', content: 'dispatch a lane' },
      timestamp: at(0),
      gitBranch: 'master',
    },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Dispatching one now, and it dispatched one of its own.' }],
      },
      timestamp: at(1),
    },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: LANE_CALL,
          name: 'Agent',
          input: { subagent_type: 'general-purpose', description: 'Read the index', prompt: BRIEF },
        }],
      },
      timestamp: at(2),
    },
    {
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: LANE_CALL, content: 'done' }],
      },
      timestamp: at(3),
    },
  ];
}

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-face-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-face-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'sess-face.jsonl'),
    `${session().map((r) => JSON.stringify(r)).join('\n')}\n`,
  );

  // **THE TWO LANES, ON DISK WHERE THE HARNESS PUTS THEM** — a `subagents/`
  // directory under the session's own name, each transcript beside an
  // `agent-<id>.meta.json`. The sidecar is the only place the dispatching
  // `toolUseId` and the parent are recorded, and the parent is what makes the
  // second row a CHILD — which is the whole subject of the indent below.
  const lanes = path.join(dir, 'sess-face', 'subagents');
  mkdirSync(lanes, { recursive: true });
  const jsonl = (rows: unknown[]): string => `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`;
  const text = (s: string): unknown[] => [{ type: 'text', text: s }];

  writeFileSync(path.join(lanes, 'agent-outer.jsonl'), jsonl([
    {
      type: 'user',
      message: { role: 'user', content: BRIEF },
      timestamp: '2026-09-09T06:01:00.000Z',
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: text('The outer lane read the index.') },
      timestamp: '2026-09-09T06:01:01.000Z',
    },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use', id: DEEP_CALL, name: 'Agent', input: { prompt: 'go one level deeper' },
        }],
      },
      timestamp: '2026-09-09T06:01:02.000Z',
    },
  ]));
  writeFileSync(path.join(lanes, 'agent-outer.meta.json'), JSON.stringify({
    agentType: 'general-purpose', description: 'Read the index',
    toolUseId: LANE_CALL, spawnDepth: 1,
  }));
  writeFileSync(path.join(lanes, 'agent-inner.jsonl'), jsonl([
    {
      type: 'user',
      message: { role: 'user', content: 'go one level deeper' },
      timestamp: '2026-09-09T06:02:00.000Z',
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: text('The inner lane went deeper.') },
      timestamp: '2026-09-09T06:02:01.000Z',
    },
  ]));
  writeFileSync(path.join(lanes, 'agent-inner.meta.json'), JSON.stringify({
    agentType: 'Explore', description: 'One level deeper',
    toolUseId: DEEP_CALL, parentAgentId: 'outer', spawnDepth: 2,
  }));

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    runCli(['conversation', 'rebuild'], cwd, () => {});
  } finally {
    process.chdir(previous);
  }
  harness = await startUiChild(cwd);
});

test.afterAll(async () => {
  await harness?.stop();
  delete process.env['CLAUDE_CONFIG_DIR'];
  if (cwd) removeTree(cwd);
  if (home) removeTree(home);
});

/** The code-skew banner, dismissed the way a person would. */
async function dismissSkew(page: Page): Promise<void> {
  const skew = page.locator('#exited:not([hidden])');
  if (await skew.isVisible().catch(() => false)) {
    await skew.locator('button').first().click().catch(() => {});
  }
}

async function openDocument(page: Page, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await dismissSkew(page);
  await page.evaluate(() => { location.hash = '#/conversations/sess-face'; });
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  await dismissSkew(page);
}

/** `#rrggbb` as the browser reports it. */
const rgb = (hex: string): string => {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${n[0]}, ${n[1]}, ${n[2]})`;
};

for (const lang of ['en', 'he'] as const) {
  /* ══ THE ROSTER CONTROL, DRESSED AS THE NAVIGATION IT IS ═════════════════ */

  test(`the roster control reads as a link and not as a jump button (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const roster = page.locator('button.tvlanes');
    await expect(roster).toBeVisible();

    const face = await roster.evaluate((el) => {
      const s = getComputedStyle(el as HTMLElement);
      // THE YARDSTICKS ARE RESOLVED IN THE LIVE DOCUMENT, not copied from the
      // file: a probe painted `var(--gold)` answers with whatever this theme,
      // language and media state make that token mean, and the nearest control
      // still wearing `.tvjump` alone is the mono box this must no longer be.
      const probe = document.createElement('span');
      probe.style.color = 'var(--gold)';
      document.body.append(probe);
      const gold = getComputedStyle(probe).color;
      probe.remove();
      const jump = document.querySelector('.tvbar button.tvjump');
      return {
        family: s.fontFamily,
        decoration: s.textDecorationLine,
        colour: s.color,
        borders: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
        background: s.backgroundColor,
        padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft],
        radius: s.borderTopLeftRadius,
        gold,
        bodyFamily: getComputedStyle(document.body).fontFamily,
        jumpFamily: jump === null ? '' : getComputedStyle(jump).fontFamily,
        jumpBorder: jump === null ? '' : getComputedStyle(jump).borderTopWidth,
      };
    });

    // The mono yardstick has to be on the page, or the comparison below is
    // vacuous — which is the shape this project has been caught by most often.
    expect(face.jumpFamily, 'a real jump button must be on the page').not.toBe('');
    // 2px SINCE 2026-09-09, and the number is not incidental to the yardstick.
    // `.tvjump` was raised from `--edge` 1px to `--dim` 2px on the owner's
    // ruling: its border measured 1.20:1 against the ground actually painted
    // outside it, and the WIDTH had to come with the token because `--dim` at
    // 1px is painted in its own 50% blend at a fractional offset and lands back
    // under the 3:1 bar. It now measures 5.55-5.68:1 on all four edges.
    // `plan:archive seq:52` carries the measurement.
    expect(face.jumpBorder).toBe('2px');

    // ONE AFFORDANCE, AND IT IS THE ONE THIS VIEWER ALREADY OWNS FOR A LINK.
    expect(face.family).toBe(face.bodyFamily);
    expect(face.family).not.toBe(face.jumpFamily);
    expect(face.decoration).toBe('underline');
    expect(face.colour).toBe(face.gold);
    expect(face.colour).toBe(rgb('#eab308'));
    // And every declaration `.tvjump` makes that a link must not keep is
    // answered rather than left half-overridden — the border, the ground, the
    // radius and the padding.
    expect(face.borders).toEqual(['0px', '0px', '0px', '0px']);
    expect(face.background).toBe('rgba(0, 0, 0, 0)');
    expect(face.padding).toEqual(['0px', '0px', '0px', '0px']);
    expect(face.radius).toBe('0px');

    // AND IT STILL NAVIGATES, because a link face on a control that does not
    // go anywhere would be the opposite defect.
    await roster.click();
    await page.waitForSelector('.rows .convrow', { timeout: 20_000 });
    expect(page.url()).toContain('#/conversations/lanes/sess-face');
  });

  /* ══ THE CHILD ROW, INDENTED BY THE SHEET ════════════════════════════════ */

  /**
   * The owner ruled the shape and it is not re-opened: A FLAT LIST WITH THE
   * CHILDREN INDENTED, NOT A FOLDER TREE — 221 lanes at depth 1, 43 at depth 2
   * and only 17 of 264 with any children at all, so a tree would spend
   * expand/collapse on 6.4% of the rows. What moves here is only WHERE the
   * indent is declared.
   */
  test(`a lane's child is indented by the stylesheet, not by script (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await page.locator('button.tvlanes').click();
    await page.waitForSelector('.rows .convrow', { timeout: 20_000 });

    const rows = page.locator('.rows .convrow');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Read the index');
    await expect(rows.nth(1)).toContainText('One level deeper');

    // **WHAT JS STILL WRITES IS THE DEPTH AND NOTHING ELSE.** `--lanedepth` is
    // an integer read off the data; the step is `--sp-3` in the sheet. A run
    // that found a `px` here would mean the runtime number came back.
    const written = await rows.nth(1).evaluate((el) => ({
      depth: (el as HTMLElement).style.getPropertyValue('--lanedepth').trim(),
      inline: (el as HTMLElement).getAttribute('style'),
      child: el.classList.contains('lanechild'),
    }));
    expect(written.child).toBe(true);
    expect(written.depth).toBe('1');
    expect(written.inline).not.toContain('px');
    // And the parent carries neither, so "parent === 0" below holds by
    // construction rather than by arithmetic.
    const parent = await rows.nth(0).evaluate((el) => ({
      child: el.classList.contains('lanechild'),
      inline: (el as HTMLElement).getAttribute('style'),
    }));
    expect(parent.child).toBe(false);
    expect(parent.inline === null || parent.inline === '').toBe(true);

    // **AND WHAT THE SHEET RESOLVES FROM IT.** `--sp-3` is 12px, so one step
    // out is 12px of `padding-inline-start` on the row's inner lines — a
    // PADDING and not a margin, because `.row` is `inline-size:100%` under
    // `*{box-sizing:border-box}` and a start margin would push the row past the
    // edge of `.rows`. `e2e/conversations.spec.ts` measures the same property
    // in both directions; this pins the value the sheet now owns.
    const inset = await rows.nth(1).locator('.convhead')
      .evaluate((el) => getComputedStyle(el as HTMLElement).paddingInlineStart);
    expect(inset).toBe('12px');
    const flat = await rows.nth(0).locator('.convhead')
      .evaluate((el) => getComputedStyle(el as HTMLElement).paddingInlineStart);
    expect(flat).toBe('0px');
    // The meta line moves with the head, or the row would read as two columns.
    const meta = await rows.nth(1).locator('.convmeta')
      .evaluate((el) => getComputedStyle(el as HTMLElement).paddingInlineStart);
    expect(meta).toBe('12px');

    // **THE HAIRLINE, WHICH IS A PSEUDO-ELEMENT FOR A MEASURED REASON.**
    // `.row:hover` and `.row[aria-pressed="true"]` both set `border-color`,
    // which is a shorthand and repaints all four edges — so a
    // `border-inline-start` here would be the tree line everywhere except
    // under the pointer, where the reader is looking. Read through `::before`,
    // which is where it actually lives.
    const line = await rows.nth(1).evaluate((el) => {
      const s = getComputedStyle(el as HTMLElement, '::before');
      return {
        content: s.content, width: s.inlineSize, colour: s.backgroundColor,
        position: s.position, start: s.insetInlineStart,
      };
    });
    expect(line.content).toBe('""');
    expect(line.position).toBe('absolute');
    expect(line.width).toBe('1px');
    expect(line.colour).toBe(rgb('#6e6e7e'));
    // One step outboard of the text it belongs to: `.row`'s own inline padding
    // is 12px, which is `--sp-3`, so `depth * --sp-3` from the padding box is
    // exactly where a depth-0 row's text begins.
    expect(line.start).toBe('12px');
    // The parent draws none — a hairline on every row would say nothing.
    const none = await rows.nth(0).evaluate(
      (el) => getComputedStyle(el as HTMLElement, '::before').content);
    expect(none).toBe('none');

    /**
     * **AND WHAT IT IS ACTUALLY PAINTED, because a hairline this lane ADDED is
     * a 1px boundary and this item's whole thesis is that a 1px boundary's
     * ratio has to be read off pixels.**
     *
     * The row is photographed with `locator.screenshot()` — the roster is a
     * plain card and not the virtualised well, so nothing detaches — and the
     * line is found where the sheet puts it rather than by looking for a grey:
     * `--sp-3` in from the row's own padding box.
     *
     * The ground is read out of the same image two pixels to either side, and
     * it is NOT `--panel`: `.card`/`.pane` are translucent over
     * `body{background:var(--ground)}`, so what is behind this line is the
     * aurora at this point on the page. Reporting `--edge-3` on `--panel`
     * would be a number about two tokens neither of which is painted here.
     */
    const png = await rows.nth(1).screenshot({
      path: `e2e/screens/roster-child-hairline-${lang}.png`,
    });
    const seen = await page.evaluate(async ({ src, at, rtl }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (ctx === null) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      // The row's border box is the image; the padding box starts one pixel
      // in, so the line sits at `1 + at` from the leading edge — which is the
      // RIGHT edge under `dir="rtl"`, because the property is logical.
      const x = rtl ? c.width - 2 - at : 1 + at;
      const column = (n: number): string => {
        const tally = new Map<string, number>();
        for (let y = 4; y < c.height - 4; y += 1) {
          const i = (y * c.width + n) * 4;
          const k = `rgb(${d[i]}, ${d[i + 1]}, ${d[i + 2]})`;
          tally.set(k, (tally.get(k) ?? 0) + 1);
        }
        return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      };
      return { line: column(x), before: column(x - 3), after: column(x + 3) };
    }, { src: `data:image/png;base64,${png.toString('base64')}`, at: 12, rtl: lang === 'he' });

    const contrast = (a: string, b: string): number => {
      const lum = (css: string): number => {
        const parts = (css.match(/\d+/g) ?? []).slice(0, 3).map(Number);
        const ch = parts.map((v) => {
          const u = v / 255;
          return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
      };
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    const said = `token ${rgb('#6e6e7e')}; painted ${seen.line} against a ground of `
      + `${seen.before} / ${seen.after} = ${contrast(seen.line, seen.before).toFixed(2)}:1 / `
      + `${contrast(seen.line, seen.after).toFixed(2)}:1`;
    // eslint-disable-next-line no-console
    console.log(`MEASURED .convrow.lanechild::before — ${said}`);

    // **IT IS DRAWN, and it is DECORATION rather than a boundary a reader must
    // see.** The line is asserted to exist and is deliberately NOT held to
    // 3.0:1: `archive/38`'s own line between the borders it raised and the four
    // it left is whether the reader needs the boundary to read the content, and
    // this row says the same fact in words on itself — "dispatched by another
    // helper agent" — as well as by its indent. `.tvsaid blockquote` spends the
    // same token on the same job. What must not happen is the line being
    // invisible while a comment claims a tree, so the paint is printed every
    // run and the difference from the ground is asserted.
    expect(seen.line, said).not.toBe(seen.before);
    expect(contrast(seen.line, seen.before), said).toBeGreaterThan(1.05);

    await page.screenshot({
      path: `e2e/screens/roster-child-indent-${lang}.png`,
      clip: (await page.locator('.convlanes').boundingBox())!,
    });
  });

  /* ══ THE QUIET LINE'S TWO DECLARATIONS ═══════════════════════════════════ */

  /**
   * **THIS MEASURES THE DRESS AND NOT THE CONTROL**, which is why it says so in
   * its own name. `quietLine`'s existence, its count, its type names and its
   * opening are all driven by `e2e/conversations.spec.ts`' own fold test
   * against a machinery run; rebuilding that fixture here to assert it a second
   * time would be a copy of a test. What is measured here is what the cascade
   * resolves for `details.tvthink.tvquiet` on this page, which is exactly the
   * claim the two new declarations make and no more.
   */
  test(`the quiet fold's own markup resolves --sp-1 and a dimmed marker (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    const resolved = await page.locator('.tvscroll').evaluate((well) => {
      const mk = (cls: string): HTMLElement => {
        const d = document.createElement('details');
        d.className = cls;
        const s = document.createElement('summary');
        s.textContent = 'nine records';
        d.append(s);
        well.append(d);
        return d;
      };
      const outer = mk('tvthink');
      const quiet = mk('tvthink tvquiet');
      const summary = quiet.querySelector('summary')!;
      const out = {
        outerMargin: getComputedStyle(outer).marginBlockStart,
        quietMargin: getComputedStyle(quiet).marginBlockStart,
        // The summary is dressed by `.tvthink>summary` and by nothing of
        // `.tvquiet`'s own — the borrow the control's own header records.
        family: getComputedStyle(summary).fontFamily,
        colour: getComputedStyle(summary).color,
        cursor: getComputedStyle(summary).cursor,
        marker: getComputedStyle(summary, '::marker').color,
        outerMarker: getComputedStyle(outer.querySelector('summary')!, '::marker').color,
        mono: getComputedStyle(document.querySelector('.tvbar button.tvjump')!).fontFamily,
      };
      outer.remove();
      quiet.remove();
      return out;
    });

    // `--sp-2` is 8px and `--sp-1` is 4px: a nested fold inside a step list is
    // airy at 8. Same specificity as `.tvthink`, declared after it, so ORDER is
    // what wins — which is what this pair of numbers is actually pinning.
    expect(resolved.outerMargin).toBe('8px');
    expect(resolved.quietMargin).toBe('4px');

    // THE BORROW IS REAL, which is why the third rule the lane asked for is not
    // in the sheet: `.tvthink>summary` already gives this summary the mono
    // face, `--dim` and the `cursor:pointer` a `<summary>` does not get on its
    // own. A `.tvquiet>summary` rule saying the same three things would be a
    // copy of the rule directly above it.
    expect(resolved.family).toBe(resolved.mono);
    expect(resolved.colour).toBe(rgb('#a9a6b8'));
    expect(resolved.cursor).toBe('pointer');

    // AND THE NESTED TRIANGLE IS NOT BRIGHTER THAN THE OUTER ONE, which is the
    // whole of the marker rule: it would otherwise inherit `--dim` at 7.99:1
    // against the outer fold's `--edge-3` at 3.79:1, and read as the inner
    // disclosure being the more important of the two. `.tvworksum::marker` is
    // the rule it matches.
    expect(resolved.marker).toBe(rgb('#6e6e7e'));
    expect(resolved.outerMarker).toBe(rgb('#a9a6b8'));
    expect(resolved.marker).not.toBe(resolved.outerMarker);
  });
}
