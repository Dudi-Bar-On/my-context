/**
 * **The plate, and the eighteen data views it must sit under.**
 *
 * `docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md` Task 7 and
 * spec §4: "Text may float on glass. Data may not." `.plate` is defined in
 * Task 3; this file checks it was actually APPLIED, not merely defined —
 * `primitives.test.ts` already covers definition ("§4's plate is defined
 * alongside the primitives, for Task 7 to apply").
 *
 * The plan's own sketch of this test (`views.filter(v =>
 * !closestHasClass(v, 'plate'))`) assumes a DOM and a `closest()` call. This
 * project ships no DOM/HTML parser as a dependency (`package.json` has none),
 * and a Playwright page is the wrong tool for a purely structural check —
 * `primitives.test.ts`'s own header explains why a browser fixture cannot
 * live under `test/` at all. `idsNotOnPlate` below is the smallest tag-
 * nesting scan that can answer "is this id inside an element carrying
 * class="plate"", built the same way `check-faint-usage.ts` builds its own
 * cascade rather than reaching for a library — and, per that file's own
 * lesson ("a checker that has never been red is not a checker"), proved
 * against synthetic markup before it is trusted against the real file.
 *
 * **The eighteen, and why these and not others.** Every id below is filled
 * by the file's own "RESTORED GRAPHICAL VIEWS" script section (the numbered
 * `── N ·` comments 1–5, 7–10, 12–15, 17–18) plus the three sibling render
 * functions that predate that numbering but share its helpers and its job —
 * `renderDet` (coverage detail, named explicitly in the ui1 Task 18
 * reconciliation note), `renderAudit` (the audit table) and `renderQ` (ask's
 * result table) — plus `paneSpark`, the item-detail aside's delivery
 * sparkline. Segmented CONTROLS that live beside these views —
 * `#tierPick`, `#gatepick`, `#spbar`, `#asktabs`, `#wfilters` — are excluded
 * on purpose: a tab strip selects, it does not display a quantity, so
 * "text may float on glass" already covers it. Static reference tables with
 * no computed quantity (doctor's findings, the gaps list, injected-now,
 * work's diff, port/packs/tut/docs/learn) are also outside this eighteen —
 * see the Task 7 report for the reasoning and for the standing question of
 * whether any of them should move too.
 *
 * **Status's counts is NO LONGER on that list — RULED, 2026-09-05, on
 * `TASK-the-status-counts-table-is-the-one-quantity-left-on-bare`.** The
 * exclusion here used to rest on HUE: a bare digit carries no colour that
 * could be misread as belonging to the wrong tier, and that argument was
 * sound — it is not what got overturned. What it never covered is CONTRAST:
 * measured in the browser, the table, its rows and `.card.pane` were all
 * `rgba(0,0,0,0)`, so the digits sat on the page gradient rather than on
 * anything that guaranteed they would read. `.plate` exists precisely to
 * give data a constant opaque field regardless of what gradient is under it,
 * and `screens/status.js` now wraps the table in one — see that file's own
 * header for the fuller ruling.
 *
 * It still is not one of the eighteen HERE, though, and that is a mechanical
 * fact rather than a second exception: every id above is filled by the
 * mockup's own scripted "RESTORED GRAPHICAL VIEWS" markup, and the mockup's
 * `<section data-p="status">` writes its counts as a literal, unscripted,
 * UNID'd `<table>` (no `.plate` div around it either) — the frozen design of
 * record predates this ruling and this task does not own it. Joining this
 * file's id-based scan would mean editing that frozen mockup for an id and a
 * wrapper this scanner requires and the real screen does not. So the plate on
 * status's counts is checked directly against the rendered screen instead —
 * `test/ui/status-screen.test.ts`'s "the counts table sits on a plate, not
 * bare glass" — and the eighteen below stay eighteen: a count moved out of an
 * exclusion list, not into this one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');
const html = readFileSync(MOCKUP, 'utf8');

/** The markup only — after `</style>`, before the real `<script>`. Keeps the
 * scan away from both the CSS text and the two `<script>alert(1)</script>`
 * refusal fixtures the markdown renderer's own tests carry as string
 * literals inside the real script, which are not markup at all. */
function bodyMarkup(source: string): string {
  const styleEnd = source.indexOf('</style>');
  assert.ok(styleEnd !== -1, 'expected a </style> close tag');
  // indexOf('<script>') from the START of the file would match line 43's
  // header PROSE ("carries an inline <style> and <script>") before it ever
  // reaches the real tag — search only from after </style>.
  const scriptStart = source.indexOf('<script>', styleEnd);
  assert.ok(scriptStart !== -1 && scriptStart > styleEnd,
    'expected a real <script> tag after </style>');
  return source.slice(styleEnd + '</style>'.length, scriptStart);
}

/** Void elements never open a scope worth tracking — an unmatched closing
 * tag later would otherwise desync the stack. */
const VOID = new Set(['input', 'br', 'img', 'link', 'meta', 'hr', 'source']);

interface Frame { underPlate: boolean }

/** True if the opening tag's `class` attribute contains the exact token
 * "plate" — not merely the substring, so a hypothetical "platetray" would
 * not false-positive. */
function hasPlateClass(openTag: string): boolean {
  const m = /\bclass="([^"]*)"/.exec(openTag);
  if (!m) return false;
  return m[1]!.split(/\s+/).includes('plate');
}

/** For every id in `ids`, walks the tag stack across `markup` and records
 * whether the element carrying that id — or any ancestor open at that
 * point — has `class="plate"`. Returns the ids for which that is NOT true,
 * including ids never found at all (a typo'd id is not a pass). */
function idsNotOnPlate(markup: string, ids: string[]): string[] {
  const remaining = new Set(ids);
  const found = new Map<string, boolean>();
  const stack: Frame[] = [];
  const tagRe = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s+(?:"[^"]*"|'[^']*'|[^'">])*)?>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(markup))) {
    const tag = m[0];
    if (tag.startsWith('</')) {
      stack.pop();
      continue;
    }
    const nameMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag);
    const name = nameMatch ? nameMatch[1]!.toLowerCase() : '';
    const parentUnderPlate = stack.length ? stack[stack.length - 1]!.underPlate : false;
    const underPlate = parentUnderPlate || hasPlateClass(tag);

    const idMatch = /\bid="([^"]+)"/.exec(tag);
    if (idMatch && remaining.has(idMatch[1]!)) found.set(idMatch[1]!, underPlate);

    const selfClosing = /\/>\s*$/.test(tag);
    if (!VOID.has(name) && !selfClosing) stack.push({ underPlate });
  }

  return ids.filter((id) => found.get(id) !== true);
}

/* ── Controls on the scanner itself, against synthetic markup — the real
   file is only checked once these hold. ── */

test('control: an id on the exact plate element passes', () => {
  const naked = idsNotOnPlate('<div class="plate" id="x"></div>', ['x']);
  assert.deepEqual(naked, []);
});

test('control: an id nested two levels under a plate ancestor passes', () => {
  const naked = idsNotOnPlate(
    '<div class="pane"><div class="plate"><table><tbody id="x"></tbody></table></div></div>',
    ['x'],
  );
  assert.deepEqual(naked, [], 'ancestry must be checked through the whole open stack, not just the parent');
});

test('control: an id with no plate ancestor at all is caught', () => {
  const naked = idsNotOnPlate('<div class="pane"><div id="x"></div></div>', ['x']);
  assert.deepEqual(naked, ['x']);
});

test('control: a plate that already CLOSED before the id does not count', () => {
  const naked = idsNotOnPlate('<div class="plate"></div><div id="x"></div>', ['x']);
  assert.deepEqual(naked, ['x'],
    'a sibling plate must not be mistaken for an ancestor — the stack pop on </div> is what this proves');
});

test('control: a class list where "plate" is one of several tokens still matches', () => {
  const naked = idsNotOnPlate('<div class="heat plate" id="x"></div>', ['x']);
  assert.deepEqual(naked, []);
});

test('control: a substring match ("platetray") is rejected — token match only', () => {
  const naked = idsNotOnPlate('<div class="platetray" id="x"></div>', ['x']);
  assert.deepEqual(naked, ['x']);
});

test('control: an id that never appears in the markup is reported, not silently passed', () => {
  const naked = idsNotOnPlate('<div class="plate" id="y"></div>', ['x']);
  assert.deepEqual(naked, ['x'], 'a missing id must fail loudly — a renamed id is not a plated id');
});

test('control: a void element (input) never pushes a stack frame', () => {
  // If <input> pushed a frame with no matching close, the frame count would
  // desync and everything after it would silently inherit the wrong ancestry.
  const naked = idsNotOnPlate(
    '<div class="plate"><input value="x"><div id="x"></div></div>',
    ['x'],
  );
  assert.deepEqual(naked, []);
});

/* ── The real file ── */

const MARKUP = bodyMarkup(html);

/** The eighteen, by screen — see the file header for how this list was
 * derived. */
const DATA_VIEWS = [
  'gates',     // hero — "why not": the gate ladder
  'ribbons',   // hero — the four-tier budget ribbon
  'tree',      // coverage — the repository magnitude tree
  'det',       // coverage — "what governs" detail table
  'stair',     // simulate — the admission staircase
  'ladder',    // simulate — the threshold ladder
  'simtbl',    // simulate — the tier fits/spills table
  'ratio',     // simulate — the diverging spill ratio
  'pulse',     // audit stream — the activity pulse
  'atbl',      // audit stream — the audit table
  'qres',      // ask — the query result table
  'comb',      // decay — the recency comb
  'heat',      // decay — the 90-day heatstrip
  'ego',       // relations — the ego-graph
  'globtree',  // composer — the live glob-match strip
  'cfgdelta',  // configure — before/after delta rows
  'spout',     // configure — scopePolicy blast radius
  'panespark', // item-detail aside — the delivery sparkline
];

test('every one of the eighteen data views sits on a plate', () => {
  const naked = idsNotOnPlate(MARKUP, DATA_VIEWS);
  assert.deepEqual(naked, [],
    'text may float on glass; data may not — the ground shows through the marks for: '
    + naked.join(', '));
});

test('the real-file control: an id given no plate at all is caught, not waved through', () => {
  // #bodyroot is <main id="bodyroot">, deliberately unplated — every screen
  // hangs off it. If this id read as "plated", the scanner would not be
  // checking ancestry against the real file's actual tag soup, only against
  // the synthetic fixtures above.
  const naked = idsNotOnPlate(MARKUP, ['bodyroot']);
  assert.deepEqual(naked, ['bodyroot']);
});
