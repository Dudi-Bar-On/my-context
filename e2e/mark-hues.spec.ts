// @basis TASK-every-kind-of-mark-is-drawn-in-the-same-grey-so-nine-kinds,
// TASK-stepping-to-the-next-mark-of-a-particular-kind-needs-its-own,
// DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn,
// INV-nothing-is-dropped-silently,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **NINE KINDS STOP BEING ONE GREY, AND THE KIND FILTER GETS A KEY** —
 * `anchors/9` and `anchors/10`, driven in a browser.
 *
 * ── WHY THE TWO ITEMS SHARE ONE FILE, WHICH IS ABOUT THE FIXTURE ─────────
 *
 * They need the same archive and it is not the one `mark-kinds.spec.ts` builds.
 * That file deals only `OWNER_KIND_CHOICES` — the six a person may pick — and
 * says so deliberately, because its subject is the form. Both items here are
 * about ALL NINE: `anchors/9` because the grouping has to be seen to cover the
 * automatic pass's own kinds (`table` is 67% of the owner's archive and
 * `ruling` is one of the two he hunts), and `anchors/10` because the ring of
 * kinds a key cycles is only worth measuring when it is long.
 *
 * ── WHY A BROWSER, PER ITEM ─────────────────────────────────────────────
 *
 *   - **`anchors/9` is a claim about RENDERED COLOUR AND ITS CONTRAST.** The
 *     hues are tokens, the ground is a gradient stack under glass, and the
 *     ratio between them is a fact about painted pixels. Reading `styles.css`
 *     in Node would have said `--crit` was fine; the browser says 4.06:1, and
 *     that measurement is why a defect is not red.
 *   - **`anchors/9` is also a claim about what survives LOSING the colour** —
 *     `@media print` flattens every hue to `#000`. Only an engine that can
 *     emulate print can answer it.
 *   - **`anchors/10` is a claim about KEYBOARD EVENTS, a `<select>`, a live
 *     region and a scroll position**, and its hardest constraint — bound by
 *     `event.code`, never `event.key` — is a claim about what a browser
 *     reports for a physical key under a layout that is not Latin.
 *
 * ── NOTHING IN THIS FILE WRITES ─────────────────────────────────────────
 *
 * Stated rather than left to be found, because `anchor-write-face.spec.ts`
 * carries `mode: 'default'` for the opposite reason. Not one test below marks,
 * relabels or drops anything: they read a list, change a `<select>`, press keys
 * that set `scrollTop`, and delete rules from a CSSOM that dies with the page.
 * The anchor store is READ-ONLY for the life of this file.
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
import { writeAnchorFile } from '../src/core/anchor-file.ts';
import { anchorIdFor } from '../src/core/anchors.ts';

const SESSION = 'sess-hues';
/** How many turns, and how often one is his. `mark-kinds.spec.ts`' shape. */
const TURNS = 96;
const EVERY = 6;

/**
 * **ALL NINE KINDS, dealt round-robin**, so every group below has members and
 * no assertion can pass by landing on the only populated one.
 *
 * The order is the GROUPING's, not the alphabet's, so a reader of this file can
 * see the three postures the stylesheet paints:
 *
 *     settled  (--gold)   a judgement was made
 *     owed     (--warn)   a fix, an answer, or an act is outstanding
 *     found    (--carry)  material the conversation produced
 *     none     (--dim)    a plain note, which claims nothing beyond "here"
 */
const GROUPS: Readonly<Record<string, readonly string[]>> = {
  kindsettled: ['ruling', 'decision'],
  kindowed: ['defect', 'question', 'todo'],
  kindfound: ['table', 'report', 'evidence'],
};
const UNGROUPED = ['note'];
const KINDS = [...Object.values(GROUPS).flat(), ...UNGROUPED];
/** Three marks of each of the nine, so every kind survives the list's page bound. */
const PER_KIND = 3;
const MARKS = KINDS.length * PER_KIND;

/** Which group a kind belongs to, or `null` — the fixture's own copy of the map. */
function groupOf(kind: string): string | null {
  for (const [group, members] of Object.entries(GROUPS)) {
    if (members.includes(kind)) return group;
  }
  return null;
}

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

/**
 * The transcript, and the byte each line begins at.
 *
 * `Buffer.byteLength`, never a character count — this archive is half Hebrew
 * and an offset is the one thing a character count may not be.
 */
function transcript(): { text: string; offsets: number[] } {
  const rows: unknown[] = [];
  for (let i = 0; i < TURNS; i += 1) {
    const mine = i % EVERY === 0;
    const body = mine
      ? `Turn ${String(i).padStart(3, '0')} is a thing I typed myself, and it holds no table.`
      : `Turn ${String(i).padStart(3, '0')} is an answer. It carries no pipe, no table header `
        + 'and no normative id, so the automatic pass finds nothing in it to mark.';
    rows.push({
      type: mine ? 'user' : 'assistant',
      message: {
        role: mine ? 'user' : 'assistant',
        content: mine ? body : [{ type: 'text', text: body }],
      },
      timestamp: new Date(Date.UTC(2026, 8, 11, 9, 0, i)).toISOString(),
    });
  }
  const offsets: number[] = [];
  let at = 0;
  for (const row of rows) {
    offsets.push(at);
    at += Buffer.byteLength(JSON.stringify(row), 'utf8') + 1;
  }
  return { text: jsonl(rows), offsets };
}

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-hue-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-hue-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const built = transcript();
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), built.text);
  const markedAt = Array.from({ length: MARKS }, (_, i) => 1 + i * 3);

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    runCli(['conversation', 'rebuild'], cwd, () => {});
    // The id is DERIVED, because in this product it always is: `anchorIdFor` is
    // what `markAnchor` composes, and a hand-written one would be a row nothing
    // the product does could ever produce.
    writeAnchorFile(path.join(cwd, '.my_context', '.anchors.jsonl'),
      markedAt.map((record, i) => ({
        id: anchorIdFor(SESSION, null, built.offsets[record] as number),
        sessionId: SESSION,
        agentId: null,
        byteOffset: built.offsets[record] as number,
        label: `${KINDS[i % KINDS.length]} mark ${String(i).padStart(2, '0')}`,
        kind: KINDS[i % KINDS.length] as string,
        // `owner` throughout, so the sweep can never rewrite the fixture
        // underneath a run — the same safety `mark-kinds.spec.ts` takes.
        origin: 'owner' as const,
        at: new Date(Date.UTC(2026, 8, 9, 9, 0, i)).toISOString(),
        note: null,
      })));
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

/** The archive screen, with the marked-points list drawn. */
async function openArchive(page: Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate(() => { location.hash = '#/conversations'; });
  await page.waitForSelector('.convanchorsbox .convanchor', { timeout: 20_000 });
}

/** The document, with the stepper drawn and its anchors loaded. */
async function openDoc(page: Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
  await page.waitForSelector('.tvscroll', { timeout: 20_000 });
  // Waiting for the NUMBER rather than for the element, so what follows is
  // about a loaded document rather than about a race.
  await expect(page.locator('.tvnavmarkcount')).toContainText(String(MARKS), { timeout: 20_000 });
}

/**
 * Put the reader ON a marked turn, by pressing the key that does it.
 *
 * **A document opens at its END** — `redraw('end')` — which is right for a
 * reader coming back to a live session and wrong for every assertion below.
 * The fixture's marks run from record 1 to record 79 of 96, so at the end no
 * marked turn is drawn at all, and `N` correctly answers "nothing is marked
 * after this point". Two tests in this file reported that as a defect before
 * the view was moved, which is the product working.
 *
 * **`Shift+N` AND NOT `scrollTop = 0`, and that is a finding rather than a
 * preference.** Measured here 2026-09-15: writing `scrollTop = 0` on `.tvscroll`
 * leaves it reading 0 and leaves rows **85 to 90 drawn** — the well virtualises,
 * and its repaint does not come from the raw `scroll` event. `landOn` is what
 * moves a reader in this product; the walk's own key is the only honest way for
 * a test to arrange the view, and it exercises the code under test rather than
 * reaching around it.
 *
 * Backwards, because every mark is behind the opening position.
 */
async function toAMarkedTurn(page: Page): Promise<void> {
  await page.keyboard.press('Shift+KeyN');
  await page.waitForSelector('.tvanchorkind', { timeout: 20_000, state: 'attached' });
}

/* ══ anchors/9 — COLOUR ═══════════════════════════════════════════════════ */

interface Painted {
  readonly kind: string;
  readonly cls: string;
  readonly colour: string;
  /** The row's rail, which is the carrier a reader sees without reading. */
  readonly rail: string;
  /** The glyph beside the word — `glyphed`'s `data-g`, or its text. */
  readonly glyph: string;
  readonly word: string;
}

/** Every kind field drawn in the marks list, with what the browser painted it. */
function paintedKinds(page: Page): Promise<Painted[]> {
  return page.evaluate(() => {
    const out: Painted[] = [];
    for (const row of document.querySelectorAll('.convanchorsbox .convanchor')) {
      const field = row.querySelector('.convanchorkind');
      if (field === null) continue;
      const label = (row.querySelector('.convanchorlabel')?.textContent ?? '').trim();
      // `glyphed` builds `span.gw > span.g[aria-hidden] + <the keyed word>`, so
      // the mark and the word are two elements and the word is what is left of
      // the wrapper once the mark is taken out. Read that way rather than as one
      // string, because "the glyph is a mark BESIDE the word, never instead of
      // it" is precisely the property being asserted.
      const glyphNode = field.querySelector('.gw > .g');
      const glyph = (glyphNode?.textContent ?? '').trim();
      out.push({
        // The fixture writes the kind as the first word of every label, so the
        // assertion can name the kind it is talking about without the screen
        // having to expose one.
        kind: label.split(/\s+/)[0] ?? '',
        cls: field.getAttribute('class') ?? '',
        colour: getComputedStyle(field).color,
        rail: getComputedStyle(row).borderInlineStartColor,
        glyph,
        word: (field.textContent ?? '').replace(glyph, '').trim(),
      });
    }
    return out;
  }) as Promise<Painted[]>;
}

/** What `--name` resolves to right now, read off the live sheet through a probe. */
function tokens(page: Page, names: readonly string[]): Promise<Record<string, string>> {
  return page.evaluate((list) => {
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    document.body.append(probe);
    const out: Record<string, string> = {};
    for (const name of list) {
      probe.style.setProperty('color', `var(--${name})`);
      out[name] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  }, [...names]) as Promise<Record<string, string>>;
}

test('the nine kinds resolve to three hues and the standing grey, and no two groups share one', async ({ page }) => {
  await openArchive(page);
  const painted = await paintedKinds(page);
  const want = await tokens(page, ['gold', 'warn', 'carry', 'dim', 'crit', 'ok']);

  // ANTI-VACUITY FIRST. A list that drew no rows, or rows whose kind this test
  // could not name, would satisfy every filter below.
  expect(painted.length, 'the marks list drew no kind field at all').toBeGreaterThan(0);
  const named = new Set(painted.map((p) => p.kind));
  for (const kind of KINDS) {
    expect(named.has(kind), `no row of kind "${kind}" reached the page, so its group is untested`)
      .toBe(true);
  }

  const seen = new Map<string, Set<string>>();
  for (const row of painted) {
    const group = groupOf(row.kind) ?? 'none';
    if (!seen.has(group)) seen.set(group, new Set());
    seen.get(group)!.add(row.colour);
  }
  for (const [group, colours] of seen) {
    console.log(`[hue] ${group.padEnd(11)} -> ${[...colours].join(', ')}`);
    expect(colours.size, `kinds in the ${group} group painted ${colours.size} different colours, `
      + 'so the grouping is not what the screen is actually drawing').toBe(1);
  }

  const colourOf = (group: string): string => [...seen.get(group)!][0]!;
  expect(colourOf('kindsettled'), 'a settled mark is not gold').toBe(want['gold']);
  expect(colourOf('kindowed'), 'an owed mark is not the caution hue').toBe(want['warn']);
  expect(colourOf('kindfound'), 'a found mark is not the carry hue').toBe(want['carry']);
  expect(colourOf('none'), 'a plain note did not keep the standing grey — which is the state '
    + 'this whole item is about, and the one a note is honestly in').toBe(want['dim']);

  // The budget. `DEC-the-meaning-hue-budget-is-five-…` forbids a sixth hue, and
  // a surface that started inventing one would do it here first.
  const spent = new Set(painted.map((p) => p.colour));
  expect(spent.size, `the kind field painted ${spent.size} distinct colours: `
    + `${[...spent].join(', ')}. Nine kinds do not get nine colours.`).toBe(4);
  expect([...spent].includes(want['crit']!),
    'a kind is painted `--crit`, which measures 4.06:1 as 12px text on this card and is under '
    + 'the 4.5:1 bar every control and every chip on this product is held to').toBe(false);
  expect([...spent].includes(want['ok']!),
    'a kind is painted `--ok`, which means "fine, safe, passing" everywhere else in this '
    + 'product. None of these nine kinds means that, and a hue meaning two things is how a '
    + 'five-hue budget stops meaning anything.').toBe(false);
});

test('the row rail carries the same group, so the list is scannable without reading it', async ({ page }) => {
  await openArchive(page);
  const painted = await paintedKinds(page);
  const want = await tokens(page, ['gold', 'warn', 'carry', 'edge']);
  // The amendment of 2026-08-27: a hue may narrow a group, never name one, and
  // wherever colour is spent it is spent on more than one carrier — "rail,
  // ground, weight AND word". The word is the test above; this is the rail, and
  // it is the carrier that works in peripheral vision down a list of 1,155.
  for (const group of Object.keys(GROUPS)) {
    const rows = painted.filter((p) => groupOf(p.kind) === group);
    expect(rows.length, `no row in ${group}`).toBeGreaterThan(0);
    const rails = new Set(rows.map((r) => r.rail));
    expect(rails.size, `the ${group} rows drew ${rails.size} different rails`).toBe(1);
  }
  const railOf = (group: string): string =>
    painted.find((p) => groupOf(p.kind) === group)!.rail;
  console.log(`[hue] rails: settled ${railOf('kindsettled')}, owed ${railOf('kindowed')}, `
    + `found ${railOf('kindfound')}`);
  expect(railOf('kindsettled')).toBe(want['gold']);
  expect(railOf('kindowed')).toBe(want['warn']);
  expect(railOf('kindfound')).toBe(want['carry']);
  const plain = painted.find((p) => groupOf(p.kind) === null)!;
  expect(plain.rail, 'a plain note took a meaning hue on its rail').toBe(want['edge']);
});

test('every hue the kinds spend is legible on the ground this card actually paints', async ({ page }) => {
  await openArchive(page);
  // **SCROLLED INTO VIEW BEFORE IT IS PHOTOGRAPHED, and that is `anchors/8`
  // showing up in `anchors/9`'s test.** At the suite's pinned 1280x720 the
  // marks card starts below the fold even with the session list capped, so a
  // clip taken at its `y` is a clip of nothing — which Playwright refuses
  // rather than silently returning a blank image. The scroll is the test
  // arranging to SEE the card; it is not part of the claim.
  await page.locator('.convanch').scrollIntoViewIfNeeded();
  const card = await page.locator('.convanch').boundingBox();
  expect(card, 'no marks card').not.toBeNull();
  expect(card!.y, 'the marks card is still off the top of the window after scrolling to it')
    .toBeLessThan(page.viewportSize()!.height);

  /*
   * **THE GROUND IS SAMPLED FROM PIXELS, NOT READ OFF A TOKEN.** This card is
   * glass — `--pane-tint` over a three-stop radial gradient stack — so nothing
   * in the cascade holds the colour a reader actually sees behind this text.
   * `chip-hue-authority.spec.ts` walks up to the first OPAQUE background and
   * says in its own comment that it falls back to the flat `#0b0c11` base as
   * "the honest floor"; that floor is DARKER than the real fill, which makes it
   * optimistic for light text by about a point of contrast. On this card it is
   * the difference between `--crit` reading 5.19:1 and reading 4.06:1 — between
   * passing and failing.
   *
   * So: photograph a strip that is text-free BY CONSTRUCTION and take the
   * BRIGHTEST pixel in it — brightest, because every colour here is light text
   * on a dark ground, so a lighter ground is the worse case.
   *
   * **The strip is the mark rows' own inline-start padding.** `.convanchor`
   * declares `border-inline-start:2px` then `padding-inline-start:var(--sp-2)`,
   * so the few pixels after the rail are guaranteed to hold nothing but the
   * card's ground, all the way down the list, across the gaps between rows as
   * well as inside them.
   *
   * **TWO EARLIER SAMPLERS WERE WRONG, AND THEY WERE WRONG IN OPPOSITE
   * DIRECTIONS.** The first histogrammed the WHOLE card and took the lightest
   * bucket holding 0.5% of it: on a card this size the words are about half a
   * percent of the pixels, so it returned `rgb(169, 166, 184)` — `--dim`, the
   * colour of the text it was about to score — and reported every hue at 1:1.
   * The second took the brightest pixel of a strip at the CARD's edge and
   * returned `rgb(240, 238, 246)`, which is `--ink`: the strip was not inside
   * the padding it was assumed to be. Both were caught by the guard below, and
   * it is kept for that reason rather than as ceremony.
   */
  const rows = await page.locator('.convanchorsbox .convanchors').boundingBox();
  expect(rows, 'no mark rows, so there is no padding gutter to sample').not.toBeNull();
  /*
   * **THE CLIP IS THE INTERSECTION OF THE LIST WITH THE SCROLLER, and getting
   * that wrong is what produced two wrong samplers in a row.**
   *
   * A screenshot is of the WINDOW, and this shell puts a fixed header over the
   * top 46px of it and a status strip along the bottom — `main.body` is the
   * only part that holds the card. `rows.y` goes negative the moment the list
   * is scrolled past the top (measured: **-458**), so clamping it to 0 put the
   * strip's top at the window's top while leaving its height at the list's, and
   * the column then ran straight up through the HEADER. Its text is `--ink`,
   * and `rgb(240, 238, 246)` is exactly what the guard below reported — twice,
   * which is the guard doing its job and the reason it is not ceremony.
   */
  const well = await page.locator('main.body').boundingBox();
  expect(well, 'the shell has no scrolling body, so there is no region to clip to').not.toBeNull();
  const top = Math.max(well!.y, rows!.y);
  const bottom = Math.min(well!.y + well!.height, rows!.y + rows!.height);
  const clip = {
    // Past the 2px rail and inside `padding-inline-start: var(--sp-2)` (8px),
    // so the column is the card's ground and nothing else.
    x: rows!.x + 3, y: top,
    width: 4,
    height: bottom - top,
  };
  // A one-pixel strip would score every hue against whatever happened to be on
  // that line. Fail as itself instead.
  expect(clip.height, `only ${clip.height}px of the mark list is on screen, which is too thin a `
    + 'sample to call a ground').toBeGreaterThan(150);
  console.log(`[hue] strip clip ${JSON.stringify(clip)} from rows box ${JSON.stringify(rows)}`);
  const shot = await page.screenshot({ clip });
  const measured = await page.evaluate(async (b64: string) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    const lum = (r: number, g: number, b: number): number => {
      const ch = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    // The BRIGHTEST pixel in a strip that holds no text — the worst ground any
    // of this card's words is drawn on.
    let ground = { r: 0, g: 0, b: 0, l: -1 };
    for (let i = 0; i < data.length; i += 4) {
      const l = lum(data[i]!, data[i + 1]!, data[i + 2]!);
      if (l > ground.l) ground = { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, l };
    }
    const total = data.length / 4;
    const parse = (value: string): [number, number, number] => {
      const m = /rgba?\(([^)]+)\)/.exec(value)!;
      const p = m[1]!.split(',').map((n) => Number.parseFloat(n));
      return [p[0]!, p[1]!, p[2]!];
    };
    const out: { cls: string; colour: string; ratio: number }[] = [];
    const done = new Set<string>();
    for (const field of document.querySelectorAll('.convanchorkind')) {
      const cls = field.getAttribute('class') ?? '';
      if (done.has(cls)) continue;
      done.add(cls);
      const colour = getComputedStyle(field).color;
      const lf = lum(...parse(colour));
      out.push({
        cls, colour,
        ratio: Math.round(((Math.max(lf, ground.l) + 0.05)
          / (Math.min(lf, ground.l) + 0.05)) * 100) / 100,
      });
    }
    // How far the sampled ground is from the nearest colour this card WRITES
    // WITH. A small number means the strip caught a letter, and the whole
    // measurement is then the subject scored against itself.
    let nearestInk = Infinity;
    for (const field of out) {
      const [r, g, b] = parse(field.colour);
      nearestInk = Math.min(nearestInk,
        Math.hypot(r - ground.r, g - ground.g, b - ground.b));
    }
    return { ground, fields: out, pixels: total, nearestInk: Math.round(nearestInk),
      fontSize: getComputedStyle(document.querySelector('.convanchorkind')!).fontSize };
  }, shot.toString('base64'));

  console.log(`[hue] ground rgb(${measured.ground.r}, ${measured.ground.g}, `
    + `${measured.ground.b}) — the brightest of ${measured.pixels} pixels in the rows own padding `
    + `gutter of the card. Kind fields are ${measured.fontSize}.`);
  // The instrument itself. A screenshot that came back black would score every
  // light hue at 20:1 and pass everything.
  expect(measured.ground.l, 'the sampled ground has no luminance at all, so the screenshot '
    + 'failed and every ratio below is measured against nothing').toBeGreaterThan(0);
  expect(
    measured.nearestInk,
    `the sampled ground is only ${measured.nearestInk} away in RGB from a colour this card `
    + 'writes text in, so the gutter caught a letter and every ratio below is a hue scored '
    + 'against itself. That is exactly how the first draft of this test reported 1:1 for all '
    + 'four.',
  ).toBeGreaterThan(60);
  expect(measured.fields.length, 'no kind field was measured').toBeGreaterThan(1);

  for (const field of measured.fields) {
    console.log(`[hue]   ${field.cls.padEnd(34)} ${field.colour.padEnd(20)} ${field.ratio}:1`);
  }
  const unreadable = measured.fields.filter((f) => f.ratio < 4.5);
  expect(
    unreadable.length,
    '4.5:1 is the bar `button-contrast.spec.ts` and `chip-hue-authority.spec.ts` hold every '
    + 'control and every chip to, and a kind field is 12px text — the small-text threshold. '
    + `Measured: ${unreadable.map((f) => `${f.cls} ${f.colour} ${f.ratio}:1`).join(' | ')}`,
  ).toBe(0);
});

test('colour is never the only carrier — the glyph and the word survive losing it', async ({ page }) => {
  await openArchive(page);
  const before = await paintedKinds(page);

  // EVERY ROW STILL SAYS WHICH KIND IT IS, IN TWO CHANNELS THAT ARE NOT COLOUR.
  for (const kind of KINDS) {
    const row = before.find((p) => p.kind === kind);
    expect(row, `no ${kind} row`).toBeDefined();
    expect(row!.glyph.length, `the ${kind} row carries no glyph, so a reader who cannot `
      + 'separate two hues has only the word').toBeGreaterThan(0);
    expect(row!.word.length, `the ${kind} row carries no word, so a printed copy says nothing`)
      .toBeGreaterThan(0);
  }
  const glyphs = new Set(before.map((p) => `${p.kind}:${p.glyph}`));
  console.log(`[hue] glyph per kind: ${[...glyphs].sort().join('  ')}`);
  // Two kinds in the SAME hue group are the hard case — `defect` and `question`
  // are both `--warn` — and they must still be told apart without the colour.
  const defect = before.find((p) => p.kind === 'defect')!;
  const question = before.find((p) => p.kind === 'question')!;
  expect(defect.colour, 'the fixture is wrong: these two are meant to share a hue')
    .toBe(question.colour);
  expect(defect.glyph, 'a defect and a question share a hue AND a glyph, so inside the group '
    + 'nothing tells them apart but reading').not.toBe(question.glyph);

  /*
   * **AND ON PAPER THERE IS NO COLOUR AT ALL.** `@media print` redeclares every
   * meaning token as `#000`, which is the register the item points at: *"a
   * reader who cannot separate green from orange must still scan the list."*
   * Emulated rather than argued.
   */
  await page.emulateMedia({ media: 'print' });
  const printed = await paintedKinds(page);
  await page.emulateMedia({ media: 'screen' });
  const inks = new Set(printed.map((p) => p.colour));
  console.log(`[hue] printed: ${[...inks].join(', ')}`);
  expect(inks.size, `printing left ${inks.size} different inks on the kind field, so a hue `
    + 'survived the flattening and the printed page is carrying a distinction the ink cannot')
    .toBe(1);
  expect([...inks][0], 'the printed kind field is not black').toBe('rgb(0, 0, 0)');
  for (const kind of KINDS) {
    const row = printed.find((p) => p.kind === kind)!;
    expect(row.glyph.length, `on paper the ${kind} row has lost its glyph`).toBeGreaterThan(0);
    expect(row.word.length, `on paper the ${kind} row has lost its word`).toBeGreaterThan(0);
  }
});

/**
 * **THE DETECTOR CAN SEE A RED, PROVED IN THE SAME RUN.**
 *
 * Every assertion above is about colour, and colour is the one thing a
 * stylesheet can accidentally get right for the wrong reason. This removes the
 * three group classes from the DOM — which is exactly the state the screen was
 * in before this change, `.convanchorkind{color:var(--dim)}` and nothing else —
 * and asserts that all nine kinds collapse to one grey. If they do not, the
 * hues above were coming from somewhere this change does not own.
 */
test('and every kind collapses back to one grey when the groups are taken off', async ({ page }) => {
  await openArchive(page);
  const want = await tokens(page, ['dim']);
  const stripped = await page.evaluate((groups: string[]) => {
    let touched = 0;
    for (const node of document.querySelectorAll('.convanchor, .convanchorkind')) {
      for (const group of groups) {
        if (node.classList.contains(group)) { node.classList.remove(group); touched += 1; }
      }
    }
    return touched;
  }, Object.keys(GROUPS));
  // THE REMOVAL LANDED. A mutation that matched nothing would make the
  // assertion below a second reading of the unchanged page.
  expect(stripped, 'no group class was found on any row, so nothing was removed and the '
    + 'collapse below would be true of a page this change never touched')
    .toBeGreaterThan(MARKS);

  const after = await paintedKinds(page);
  const colours = new Set(after.map((p) => p.colour));
  console.log(`[hue] classes stripped: ${colours.size} colour(s) left — ${[...colours].join(', ')}`);
  expect(colours.size, 'a kind kept a hue with its group class removed, so the colour is coming '
    + 'from a rule this change does not own and the assertions above are borrowed').toBe(1);
  expect([...colours][0], 'the collapsed state is not the standing grey the item describes')
    .toBe(want['dim']);
});

test('the kind in the DOCUMENT takes the same group as the kind in the list', async ({ page }) => {
  await openDoc(page);
  await toAMarkedTurn(page);
  // The item's defect is `.convanchorkind` AND `.tvanchorkind`, "on the row and
  // in the document alike", so a fix on one surface is half a fix.
  const want = await tokens(page, ['gold', 'warn', 'carry', 'dim']);
  const seen = await page.evaluate(() => {
    const out: { cls: string; colour: string; word: string }[] = [];
    for (const field of document.querySelectorAll('.tvanchorkind')) {
      out.push({
        cls: field.getAttribute('class') ?? '',
        colour: getComputedStyle(field).color,
        word: (field.textContent ?? '').trim(),
      });
    }
    return out;
  });
  expect(seen.length, 'the document drew no marked turn at all, so nothing here is measured')
    .toBeGreaterThan(0);
  const byClass = new Map<string, Set<string>>();
  for (const field of seen) {
    if (!byClass.has(field.cls)) byClass.set(field.cls, new Set());
    byClass.get(field.cls)!.add(field.colour);
  }
  for (const [cls, colours] of byClass) {
    console.log(`[hue] document ${cls.padEnd(30)} -> ${[...colours].join(', ')}`);
    expect(colours.size, `${cls} painted more than one colour in the document`).toBe(1);
  }
  const expected: Record<string, string> = {
    'tvanchorkind kindsettled': want['gold']!,
    'tvanchorkind kindowed': want['warn']!,
    'tvanchorkind kindfound': want['carry']!,
    tvanchorkind: want['dim']!,
  };
  for (const [cls, colours] of byClass) {
    const wanted = expected[cls];
    expect(wanted, `the document drew a kind field with an unexpected class "${cls}"`).toBeDefined();
    expect([...colours][0], `${cls} is not the colour its group asks for`).toBe(wanted);
  }
  // At least one GROUPED field reached the document, or this test is a reading
  // of a document holding only plain notes.
  expect([...byClass.keys()].some((cls) => cls !== 'tvanchorkind'),
    'no grouped kind reached the document, so only the ungrouped case was measured').toBe(true);
});

/* ══ anchors/10 — THE KIND ON A KEY ══════════════════════════════════════ */

/** What the kind `<select>` currently holds and is set to. */
function filterState(page: Page): Promise<{ value: string; options: string[]; said: string }> {
  return page.evaluate(() => {
    const pick = document.querySelector<HTMLSelectElement>('.tvnavkind');
    const said = document.querySelector<HTMLElement>('.tvnavsaid');
    return {
      value: pick === null ? '(no select)' : pick.value,
      options: pick === null ? [] : [...pick.options].map((o) => o.value),
      said: said === null || said.hidden ? '' : (said.textContent ?? '').trim(),
    };
  });
}

test('K walks the kinds this document holds, and comes back round to every kind', async ({ page }) => {
  await openDoc(page);
  const start = await filterState(page);
  console.log(`[key] the select offers ${JSON.stringify(start.options)}`);
  expect(start.value, 'the walk does not open unnarrowed').toBe('');
  // ANTI-VACUITY: a one-option select would make the ring below trivially
  // correct and say nothing about a document that holds several kinds.
  expect(start.options.length, 'the select offers no ring to walk').toBeGreaterThan(3);

  const walked: string[] = [];
  for (let i = 0; i < start.options.length; i += 1) {
    await page.keyboard.press('KeyK');
    walked.push((await filterState(page)).value);
  }
  console.log(`[key] K x${start.options.length} walked ${JSON.stringify(walked)}`);
  expect(walked.slice(0, -1), 'K did not walk the select in its own order')
    .toEqual(start.options.slice(1));
  expect(walked[walked.length - 1],
    'K past the last kind did not come back to every kind. A ring with no way home is a filter '
    + 'a keyboard reader can enter and not leave, and Escape is spoken for twice on this screen.')
    .toBe('');

  // The other direction, which is the convention `Shift+N` and `Shift+U` set.
  await page.keyboard.press('Shift+KeyK');
  expect((await filterState(page)).value, 'Shift+K did not go the other way round the ring')
    .toBe(start.options[start.options.length - 1]);
});

test('the key drives the SAME walk, not a second one that can disagree', async ({ page }) => {
  await openDoc(page);
  const everyKind = (await page.locator('.tvnavmarkcount').textContent() ?? '').trim();

  // Narrow with the KEY, then read the counter the `<select>` drives — the one
  // `anchors/6` put inside `markStops`. If the key had its own state, this
  // number would not move.
  await page.keyboard.press('KeyK');
  const chosen = (await filterState(page)).value;
  await expect(page.locator('.tvnavmarkcount'), 'the counter never noticed the key')
    .not.toHaveText(everyKind, { timeout: 10_000 });
  const filtered = (await page.locator('.tvnavmarkcount').textContent() ?? '').trim();
  console.log(`[key] every="${everyKind}" | after K (${chosen}) "${filtered}"`);
  expect(everyKind, 'the unfiltered counter does not report every mark').toContain(String(MARKS));
  expect(filtered, 'the filtered counter does not name the kind it is counting').toContain(chosen === '' ? '' : ' ');
  expect(filtered, 'the filtered counter reports the whole set, so the key set a value the walk '
    + 'is not reading').not.toContain(`${MARKS} `);

  // AND THE STEP OBEYS IT. `N` is untouched by this item; what changed is what
  // it walks over. Stepping must land on a mark OF THE CHOSEN KIND, and the
  // landing sentence must name that kind — the item's own constraint: *"'3 of
  // 24' when filtered to defects is a lie unless the sentence says defects."*
  //
  // BACKWARDS, because the document opens at its end and every mark in this
  // fixture is behind that — `toAMarkedTurn` carries the measurement. The
  // direction is not the claim; what the step walks over is.
  const word = (await page.locator('.tvnavkind option:checked').textContent() ?? '').trim();
  await toAMarkedTurn(page);
  await expect(page.locator('.tvnavsaid'), 'the step said nothing after the key narrowed the walk')
    .toBeVisible({ timeout: 10_000 });
  const landing = (await page.locator('.tvnavsaid').textContent() ?? '').trim();
  console.log(`[key] Shift+N after K (${chosen}) landed: "${landing}"`);
  expect(landing, 'the landing sentence does not say how many of THIS KIND there are, so the '
    + 'number a reader is given is about a walk they are not on')
    .toContain(`of ${PER_KIND}`);
  expect(landing, 'the landing sentence does not name the kind the walk was narrowed to')
    .toContain(word);
});

test('the change of subject is announced, in the region the walk already speaks in', async ({ page }) => {
  await openDoc(page);
  const live = page.locator('.tvnavsaid');
  await expect(live, 'the live region is showing before anything happened').toBeHidden();
  await page.keyboard.press('KeyK');
  await expect(live, 'changing the subject of the walk said nothing, so a reader who cannot see '
    + 'the select move has no way to know why the next press went somewhere unexpected')
    .toBeVisible({ timeout: 10_000 });
  const first = (await live.textContent() ?? '').trim();
  const chosen = (await filterState(page)).value;
  console.log(`[key] K -> ${chosen}: "${first}"`);
  expect(first.length, 'the announcement is empty').toBeGreaterThan(0);
  expect(await live.getAttribute('aria-live'), 'the region is not live, so nothing is announced')
    .toBe('polite');

  // **AND THE SELECT ANNOUNCES TOO.** The announcement is written into the ONE
  // `change` handler every route reaches, so the mouse route gets the same
  // sentence rather than the keyboard route getting a private one.
  //
  // The select is in the step panel since `semantic/15`, and the panel is
  // opened the way a reader opens it — the menu's second row. `K` above needed
  // nothing open, which is the half that matters and is proved by it working
  // before this line.
  await page.evaluate(() => { document.getSelection()?.removeAllRanges(); });
  await page.locator('.tvscroll .tvturn').first().click({ button: 'right' });
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  await page.locator('.tvmenu .tvmenuitem').nth(1).click();
  await expect(page.locator('dialog.mcpanel[data-panel="navigate"][open]'))
    .toHaveCount(1, { timeout: 10_000 });
  await page.locator('.tvnavkind').selectOption('');
  await expect.poll(async () => (await live.textContent() ?? '').trim(), { timeout: 10_000 })
    .not.toBe(first);
  console.log(`[key] select -> every kind: "${(await live.textContent() ?? '').trim()}"`);
});

test('the key is inert inside every field on the screen', async ({ page }) => {
  await openDoc(page);
  const before = await filterState(page);

  // The find box. A reader typing "kind" into it must not walk the filter four
  // times — the item's second constraint, and the same one `M`, `N` and `U`
  // already hold.
  //
  // **IT IS IN THE SEARCH PANEL SINCE `semantic/15`**, so it is opened the way
  // a reader opens it: `/`, which both opens the panel and lands the caret in
  // the field. `.first()` is kept because there is a second `.tvfind` on the
  // archive screen behind this one.
  await page.locator('.tvscroll').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('/');
  await expect(page.locator('dialog.mcpanel[data-panel="search"][open]'))
    .toHaveCount(1, { timeout: 10_000 });
  await page.locator('dialog.mcpanel[data-panel="search"] .tvfind').first().focus();
  await page.keyboard.press('KeyK');
  await page.keyboard.press('Shift+KeyK');
  expect((await filterState(page)).value,
    'K fired while the find box had focus, so typing a word into it walks the filter')
    .toBe(before.value);

  // The `<select>` ITSELF, which is the subtle one: its own keys are letters,
  // so a reader picking a kind by typing must not also fire whatever that
  // letter is bound to. `inField` lists SELECT for exactly this.
  await page.locator('.tvnavkind').focus();
  await page.keyboard.press('KeyK');
  const afterSelect = await filterState(page);
  console.log(`[key] inert in field: find box -> "${before.value}", `
    + `select focused -> "${afterSelect.value}"`);
  // The browser's own type-ahead may move a `<select>`'s value; what must not
  // happen is the CYCLE running. With the caret on the select, `K` may select
  // an option whose text starts with K (there is none) — so the value must be
  // unchanged, and if a future kind ever begins with that letter this assertion
  // is the thing that will say so rather than the cycle silently firing.
  expect(afterSelect.value, 'the shortcut fired while the select had focus').toBe(before.value);
});

/**
 * **THE BINDING IS THE PHYSICAL KEY, AND THIS IS THE ASSERTION THE ITEM ASKS
 * FOR IN AS MANY WORDS.**
 *
 * *"bind by `event.code`, never `event.key` — on a Hebrew layout the key
 * printed `M` reports `key: 'צ'`, and a `key` table silently unbinds every
 * shortcut for half this archive."*
 *
 * Playwright cannot install a Hebrew layout, so the event is DISPATCHED with
 * the pair a Hebrew layout actually produces: `code: 'KeyK'` (the physical key)
 * and `key: 'ל'` (what it prints). A handler reading `key` sees a letter it has
 * never heard of and does nothing; one reading `code` behaves identically for
 * both readers. That is the whole difference, and it is the difference this
 * archive's owner lives on.
 */
test('the key is the physical one, so it works on a Hebrew layout too', async ({ page }) => {
  await openDoc(page);
  const before = await filterState(page);
  const fired = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      // What a Hebrew layout PRINTS on the key stamped K.
      key: 'ל',
      code: 'KeyK',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  });
  const after = await filterState(page);
  console.log(`[key] code=KeyK key=ל -> "${before.value}" became "${after.value}" `
    + `(handled: ${fired})`);
  expect(fired, 'the handler did not claim the event, so it is matching on `key` and a Hebrew '
    + 'reader has no kind shortcut at all').toBe(true);
  expect(after.value, 'the filter did not move for a physical K pressed on a Hebrew layout')
    .not.toBe(before.value);
});

test('the key is shown on the control, and it does not replace the ones that were there', async ({ page }) => {
  await openDoc(page);
  const shown = await page.evaluate(() => {
    const pick = document.querySelector<HTMLSelectElement>('.tvnavkind');
    const chip = document.querySelector('.tvnavkindkey');
    return {
      shortcuts: pick?.getAttribute('aria-keyshortcuts') ?? '',
      title: pick?.title ?? '',
      chip: (chip?.textContent ?? '').trim(),
      chipHidden: chip?.getAttribute('aria-hidden') ?? '',
      name: pick?.getAttribute('aria-label') ?? '',
    };
  });
  console.log(`[key] on the control: chip "${shown.chip}", `
    + `aria-keyshortcuts "${shown.shortcuts}", title "${shown.title}"`);
  // "A keyboard route nobody can discover is the same defect as a right-click-
  // only action" — the item's own closing sentence, and it names three carriers.
  expect(shown.chip, 'nothing on the control shows the key, so the fast path is as '
    + 'undiscoverable as the right-click was').toBe('K');
  expect(shown.chipHidden, 'the visible chip is not hidden from assistive tech, so the control '
    + 'is announced with a stray letter glued onto its name').toBe('true');
  expect(shown.shortcuts, 'the control does not announce BOTH keys as shortcuts').toBe('K Shift+K');
  expect(shown.title, 'the hover sentence does not name the backwards key, so a reader is left '
    + 'to infer it from a convention nothing on screen states').toContain('Shift+K');
  expect(shown.name.length, 'the select lost its accessible name to the shortcut').toBeGreaterThan(0);

  // **ADD, DO NOT REPLACE** — the item's binding instruction. The four steppers
  // still answer, and they still say their own keys.
  /*
   * **THE FOUR STEPPERS THAT HAVE A KEY, NAMED BY THEIR GROUPS.**
   *
   * `.tvnavstep` on its own stopped meaning "the four" on 2026-09-16, when
   * `semantic/8` gave the MATCH stepper the same class. Those two have never
   * had a binding and were never meant to — this assertion is about `K` not
   * replacing `N`, `Shift+N`, `U` and `Shift+U` — so a widened selector was
   * reporting two empty strings as two steppers that had lost their keys.
   * Measured against HEAD while `semantic/12` was in flight: it fails there
   * too, so it is a stale selector rather than a regression, repaired here
   * because this is the lane that found it.
   */
  const kept = await page.evaluate(() => [
    ...document.querySelectorAll('.tvnavmarks .tvnavstep, .tvnavyous .tvnavstep'),
  ].map((b) => b.getAttribute('aria-keyshortcuts') ?? ''));
  console.log(`[key] the steppers still carry ${JSON.stringify(kept)}`);
  expect(kept.sort(), 'a stepper lost its binding, so the new key replaced rather than added')
    .toEqual(['N', 'Shift+N', 'Shift+U', 'U']);
  await page.keyboard.press('KeyN');
  await expect(page.locator('.tvnavsaid'), 'N stopped stepping when K was added')
    .toBeVisible({ timeout: 10_000 });
});

/* ══ AND IN HEBREW, WHERE THE GLYPH AND THE WORD SWAP SIDES ══════════════ */

/**
 * **BOTH ITEMS CLOSE ON A HEBREW READING, and each says so.**
 *
 *   - `anchors/9`: *"at the same contrast the rest of the screen is held to, in
 *     both themes, and in Hebrew where the glyph and the word swap sides."*
 *   - `anchors/10`: the whole reason the binding is `event.code` — half this
 *     archive is Hebrew, and a `key` table would unbind every shortcut for it.
 *
 * The language is set the way every other bilingual test in this suite sets it:
 * `localStorage` before the first script runs, so the page boots into it rather
 * than being switched after it has drawn.
 */
async function inHebrew(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try { localStorage.setItem('myctx-lang', 'he'); } catch { /* private mode */ }
  });
}

test('the hue, the glyph and the key all survive the page turning right-to-left', async ({ page }) => {
  await inHebrew(page);
  await openArchive(page);
  const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
  expect(dir, 'the page did not turn right-to-left, so this test is a second English run')
    .toBe('rtl');

  const painted = await paintedKinds(page);
  expect(painted.length, 'no kind field drew in Hebrew').toBeGreaterThan(0);
  const want = await tokens(page, ['gold', 'warn', 'carry', 'dim']);
  const byGroup = new Map<string, Set<string>>();
  for (const row of painted) {
    const group = groupOf(row.kind) ?? 'none';
    if (!byGroup.has(group)) byGroup.set(group, new Set());
    byGroup.get(group)!.add(row.colour);
  }
  for (const [group, colours] of byGroup) {
    console.log(`[he] ${group.padEnd(11)} -> ${[...colours].join(', ')}`);
    expect(colours.size, `${group} painted more than one colour in Hebrew`).toBe(1);
  }
  expect([...byGroup.get('kindsettled')!][0]).toBe(want['gold']);
  expect([...byGroup.get('kindowed')!][0]).toBe(want['warn']);
  expect([...byGroup.get('kindfound')!][0]).toBe(want['carry']);
  expect([...byGroup.get('none')!][0]).toBe(want['dim']);

  // **THE WORD IS THE HEBREW WORD, not the English one wearing a hue.** A hue
  // that resolved correctly over an untranslated table would be the colour
  // working and the carrier that survives print not working at all.
  const ruling = painted.find((p) => p.kind === 'ruling');
  expect(ruling, 'no ruling row in Hebrew').toBeDefined();
  console.log(`[he] ruling reads "${ruling!.word}" beside "${ruling!.glyph}"`);
  expect(ruling!.word, 'the kind is drawing its English word to a Hebrew reader')
    .toBe('הכרעה');
  // The provenance clause is gone in BOTH tables — the item's smaller fix. The
  // Hebrew half is not caught by the word-count gate in
  // `test/ui/anchor-kind-vocabulary.test.ts` (Hebrew carries the person as a
  // verb suffix, not as a separate token), so it is asserted here instead.
  expect(ruling!.word, 'the Hebrew kind still says who gave the ruling, which is provenance and '
    + 'is already one field along').not.toContain('שנתתם');
  expect(ruling!.glyph.length, 'the glyph went missing when the page turned').toBeGreaterThan(0);
});

test('the kind key works right-to-left, where it prints a different letter', async ({ page }) => {
  await inHebrew(page);
  await openDoc(page);
  const before = await filterState(page);
  expect(before.options.length, 'no ring to walk in Hebrew').toBeGreaterThan(3);

  await page.keyboard.press('KeyK');
  const after = await filterState(page);
  console.log(`[he] K moved the filter "${before.value}" -> "${after.value}"; said "${after.said}"`);
  expect(after.value, 'K did nothing on a right-to-left page').not.toBe(before.value);
  expect(after.said.length, 'the change of subject was not announced in Hebrew')
    .toBeGreaterThan(0);

  // The legend on the control is the LATIN keycap in both languages, because it
  // is what is printed on the physical key a reader is looking at — the same
  // decision `DOC_SHORTCUTS`' `show` field carries. What must not happen is it
  // landing at the wrong end of a Hebrew label, which is what `span.m` prevents.
  const chip = await page.evaluate(() => {
    const node = document.querySelector('.tvnavkindkey');
    return {
      text: (node?.textContent ?? '').trim(),
      classes: node?.getAttribute('class') ?? '',
      direction: node === null ? '' : getComputedStyle(node).direction,
    };
  });
  console.log(`[he] the key chip reads "${chip.text}", class "${chip.classes}", `
    + `direction ${chip.direction}`);
  expect(chip.text, 'the key legend is missing in Hebrew').toBe('K');
  expect(chip.classes.split(/\s+/), 'the Latin legend is not bidi-isolated, so it lands at the '
    + 'wrong end of a Hebrew bar').toContain('m');
  expect(chip.direction, 'the isolated legend did not resolve left-to-right').toBe('ltr');
});
