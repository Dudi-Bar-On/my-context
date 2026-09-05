/**
 * The Decay screen's DECIDABLE half, tested in Node — and the line where that
 * half stops.
 *
 * Spec §6 names the DOM glue in `app.js` and `screens/*.js` as the untested
 * surface, and `test/ui/viewmodel.test.ts`'s own header says why: testing it
 * would need a browser dependency this project does not have. Nothing below
 * builds an element or stands in a `document`. What it does test is everything
 * `screens/decay.js` DECIDES before it touches one:
 *
 *   - the recency comb's ORDINAL — that a tooth's position is read off the
 *     session order the server published and never re-derived, that an item
 *     the order cannot reach is COUNTED rather than placed or dropped, and
 *     that cold/warm/never/pinned-and-cold are read off the report rather
 *     than recomputed from its parts (`combRows`);
 *   - the axis the ordinal is plotted on (`combTicks`), pinned to the tick
 *     list in the mockup's own `renderComb` rather than to a copy of it;
 *   - the heatstrip's day arithmetic (`heatRows`, `heatSince`, `heatLevel`):
 *     UTC days, ninety cells whatever the log holds, a spilled day drawn as
 *     spilled even when it also delivered, and one intensity scale for the
 *     card;
 *   - that the strip is read from the source `dec.heatn` names on screen —
 *     `audit_item.role` joined to `audit.at` — and NOT from the ledger, which
 *     is the one approximation the plan refuses by name;
 *   - that every string key the screen names is declared in BOTH tables with
 *     its slots supplied, and that every `dec.` key the English table declares
 *     is actually placed by the screen — the two directions of the same fact;
 *   - that no translated string is assigned rather than appended (owner ruling
 *     A1), that no `style` attribute is written (the shipped `style-src
 *     'self'` blocks it), and that no class is invented that the mockup's own
 *     `<section data-p="decay">` does not draw.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE, AND WHY NOT DIRECTLY ─────────────
 *
 * `test/ui/work-screen.test.ts` established the mechanism and its reasoning is
 * unchanged here: a screen imports its dependencies by the specifiers the
 * BROWSER resolves (`/screens/parts.js`), and Node resolves a leading `/` as a
 * filesystem path from the drive root. So the module's own bytes are read, its
 * root-absolute specifiers are rewritten to `file://` URLs, and the result is
 * imported as a `data:` module. The rewrite is COUNTED and the result
 * re-checked for a surviving `/` specifier, because a rewrite that silently
 * missed one would import a different module graph than the browser runs.
 *
 * `parts.js` touches no DOM at module scope, so no stand-in `document` is
 * needed to import the screen. One is deliberately NOT supplied: supplying one
 * would let this file drift into testing the glue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DECAY_WINDOW_DEFAULT, SESSIONS_LIMIT } from '../../src/ui/read-model.ts';
import { allowedClasses } from '../helpers/shipped-classes.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const DECAY_JS = path.join(PUBLIC, 'screens', 'decay.js');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const decaySource = readFileSync(DECAY_JS, 'utf8');

interface CombRow {
  id: string;
  sessionsAgo: number | null;
  cold: boolean;
  always: boolean;
  unrestricted: boolean;
  never: boolean;
}

interface HeatRow { id: string; cells: (string | null)[] }

interface DecayRowLike {
  id: string; always?: boolean; useCount: number;
}

interface ReportLike {
  window: number; sessionsRecorded: number;
  cold: DecayRowLike[]; warm: DecayRowLike[]; unrestricted: { id: string }[];
}

interface EventLike { sessionId: string; itemId: string }

interface RecordLike {
  at: string;
  injected?: { id: string }[];
  spilled?: { id: string }[];
}

/**
 * The screen's published interface. Hand-declared rather than inferred, so it
 * is an assertion in its own right: a module that drifts from it fails here
 * rather than in a browser nobody is watching.
 */
interface DecayModule {
  W: number;
  MAX_S: number;
  badpinOutward: (cx: number) => boolean;
  HEAT_DAYS: number;
  HEAT_ROWS: number;
  AUDIT_LIMIT: number;
  combRows: (report: ReportLike, series: EventLike[], order: string[])
    => { rows: CombRow[]; unplaceable: number };
  combTicks: (window: number) => [number, string][];
  heatRows: (records: RecordLike[], now: Date, days?: number, limit?: number) => HeatRow[];
  heatSince: (now: Date) => string;
  heatLevel: (count: number, max: number) => number;
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

/** `from '/screens/parts.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

async function decayModule(): Promise<DecayModule> {
  let rewritten = 0;
  const text = decaySource.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.equal(rewritten, 2,
    'expected decay.js to import two browser modules (/lib/disclosure.js, /screens/parts.js); '
    + `the rewrite matched ${rewritten}. A specifier this pattern cannot see is a module Node `
    + 'would resolve from the drive root, and the import below would fail for a reason that '
    + 'reads like a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as DecayModule;
}

/** `<section data-p="decay">…</section>`, the design of record for this screen. */
function mockupSection(): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf('<section data-p="decay"');
  assert.notEqual(start, -1, 'the mockup has no [data-p="decay"] section');
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, 'the decay section is never closed');
  return html.slice(start, end);
}

/** `renderComb` / `renderHeat` — the mockup's SCRIPT, which is the behaviour of record. */
function mockupScript(name: string): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf(`function ${name}(){`);
  assert.notEqual(start, -1, `the mockup has no ${name}()`);
  const end = html.indexOf('\nfunction ', start + 1);
  assert.notEqual(end, -1, `${name}() is never closed`);
  return html.slice(start, end);
}

/* -------------------------------------------------------------------------- *
 * combRows — the ordinal, and the three states that are not one.
 * -------------------------------------------------------------------------- */

/** Newest session first, which is the order `/api/sessions` publishes. */
const ORDER = ['s0', 's1', 's2', 's3'];

function report(over: Partial<ReportLike> = {}): ReportLike {
  return {
    window: DECAY_WINDOW_DEFAULT, sessionsRecorded: 4,
    cold: [], warm: [], unrestricted: [], ...over,
  };
}

test('combRows places a tooth at its index in the session order the server published', async () => {
  const { combRows } = await decayModule();
  const { rows, unplaceable } = combRows(
    report({
      warm: [{ id: 'RULE-a', always: false, useCount: 3 }],
      cold: [{ id: 'RULE-b', always: false, useCount: 1 }],
    }),
    [
      // `RULE-a` was delivered in the newest session AND in an older one; the
      // ordinal is the most recent, which is the smaller index.
      { sessionId: 's2', itemId: 'RULE-a' },
      { sessionId: 's0', itemId: 'RULE-a' },
      { sessionId: 's3', itemId: 'RULE-b' },
    ],
    ORDER,
  );
  assert.equal(unplaceable, 0);
  assert.deepEqual(rows.map((r) => [r.id, r.sessionsAgo]), [['RULE-a', 0], ['RULE-b', 3]]);
  // The order is the SERVER'S: nothing here sorts by a timestamp, so the
  // series carries no `injectedAt` at all in this fixture and the answer is
  // still exact. A screen that re-derived `MAX(injected_at) DESC` would need
  // one and would fail here.
  assert.ok(!/injectedAt/.test(decaySource),
    'decay.js reads an injection TIMESTAMP. The session ordering belongs to the endpoint that '
    + 'owns it; a second spelling of it in the browser is how a tooth\'s position and its colour '
    + 'come to disagree.');
});

test('combRows reads cold, always and unrestricted off the report, never off the ordinal', async () => {
  const { combRows } = await decayModule();
  // A WARM item at ordinal 25, past a window of 20 — impossible on a healthy
  // report and exactly the disagreement this test pins. The screen must draw
  // what the server classified, not what the axis position implies.
  const order = Array.from({ length: 30 }, (_u, i) => `s${i}`);
  const { rows } = combRows(
    report({
      window: 20,
      warm: [{ id: 'RULE-warm', always: true, useCount: 2 }],
      unrestricted: [{ id: 'RULE-warm' }],
    }),
    [{ sessionId: 's25', itemId: 'RULE-warm' }],
    order,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.cold, false, 'membership of report.warm is the classification');
  assert.equal(rows[0]!.sessionsAgo, 25);
  assert.equal(rows[0]!.always, true);
  assert.equal(rows[0]!.unrestricted, true,
    'unrestricted is an OVERLAY over cold ∪ warm — a row appears in one bucket AND in this list');
});

test('combRows sends useCount 0 to the never bucket rather than to a position', async () => {
  const { combRows } = await decayModule();
  const { rows } = combRows(
    report({ cold: [{ id: 'KNOWN-x', always: false, useCount: 0 }] }),
    [],
    ORDER,
  );
  assert.deepEqual(rows.map((r) => [r.id, r.never, r.sessionsAgo]), [['KNOWN-x', true, null]]);
});

test('combRows counts a tooth it cannot place and never invents a position for it', async () => {
  const { combRows } = await decayModule();
  // The endpoint's session window is finite (SESSIONS_LIMIT); an item last
  // delivered before it has an ordinal of "at least that many" and no more.
  const { rows, unplaceable } = combRows(
    report({
      cold: [
        { id: 'RULE-old', always: false, useCount: 4 },
        { id: 'RULE-seen', always: false, useCount: 1 },
      ],
    }),
    [
      { sessionId: 'before-the-window', itemId: 'RULE-old' },
      { sessionId: 's1', itemId: 'RULE-seen' },
    ],
    ORDER,
  );
  assert.equal(unplaceable, 1, 'an unplaceable tooth is COUNTED, so the chart can say so');
  assert.deepEqual(rows.map((r) => r.id), ['RULE-seen'],
    'and it is not placed — a tooth at a position the response cannot name is a fabricated mark');
  assert.ok(SESSIONS_LIMIT > 0, 'the window this bound comes from is a real, exported number');
});

test('combRows orders by ordinal with never last and ties broken on the id', async () => {
  const { combRows } = await decayModule();
  const { rows } = combRows(
    report({
      cold: [
        { id: 'RULE-never-b', always: false, useCount: 0 },
        { id: 'RULE-never-a', always: false, useCount: 0 },
        { id: 'RULE-two', always: false, useCount: 1 },
      ],
      warm: [
        { id: 'RULE-zero-b', always: false, useCount: 1 },
        { id: 'RULE-zero-a', always: false, useCount: 1 },
      ],
    }),
    [
      { sessionId: 's2', itemId: 'RULE-two' },
      { sessionId: 's0', itemId: 'RULE-zero-b' },
      { sessionId: 's0', itemId: 'RULE-zero-a' },
    ],
    ORDER,
  );
  assert.deepEqual(rows.map((r) => r.id),
    ['RULE-zero-a', 'RULE-zero-b', 'RULE-two', 'RULE-never-a', 'RULE-never-b'],
    'the same corpus must draw the same chart twice, so the whole order is total');
});

/* -------------------------------------------------------------------------- *
 * combTicks — the axis, pinned to the mockup's own list.
 * -------------------------------------------------------------------------- */

test('combTicks is the mockup\'s own tick list, read out of the mockup', async () => {
  const { combTicks, MAX_S } = await decayModule();
  const script = mockupScript('renderComb');
  // Read out of the design of record rather than copied into this file. A copy
  // would go stale the moment the mockup moved a tick and nothing would say so.
  const list = /for\(const \[s,lab\] of \[(.*?)\]\)\{/s.exec(script);
  assert.ok(list, 'renderComb no longer builds its ticks from a literal list');
  const drawn = [...list[1]!.matchAll(/\[(\d+),/g)].map((m) => Number(m[1]));
  assert.deepEqual(drawn, [0, 1, 5, 20, 50], 'the mockup\'s five ticks moved');
  assert.deepEqual(combTicks(20).map(([s]) => s), drawn);
  // `maxS` is the axis's far end and the mockup declares it beside the ticks.
  const maxS = /const .*?maxS=(\d+)/.exec(script);
  assert.ok(maxS, 'renderComb no longer declares maxS');
  assert.equal(MAX_S, Number(maxS[1]));
});

test('combTicks puts the asked-for window on the axis even when it is not one of the five', async () => {
  const { combTicks } = await decayModule();
  assert.deepEqual(combTicks(30).map(([s]) => s), [0, 1, 5, 20, 30, 50],
    'the boundary the whole screen is about must be ON the axis whatever ?window=N said');
  assert.deepEqual(combTicks(61).map(([s]) => s), [0, 1, 5, 20, 50],
    'a window past the axis end is left off rather than clamped onto a position it does not hold');
});

test('the badpin annotation turns inward rather than running off the chart', async () => {
  const { badpinOutward, W } = await decayModule();
  // The mockup's own sample sits at 34 sessions, mid-axis, so it never has to
  // choose — and copying its unconditional "nine units to the reading end"
  // pushed the sentence off the viewBox for every pinned item in the terminal
  // never box, which is where a pinned item with no injection at all lands.
  const neverDot = W - 92 + 16 + 23; // NEVER_X + NEVER_W / 2, the mockup's own
  assert.equal(badpinOutward(neverDot), false,
    `a dot at ${neverDot} of ${W} has 44 units of chart left; the annotation is ~200 wide`);
  assert.equal(badpinOutward(300), true, 'mid-axis keeps the mockup\'s own placement');
});

test('an id label cannot reach the unrestricted overlay it would otherwise strike through', async () => {
  // The id label is `class: 'mono'`, so its size is `--fs-chart-mono`'s 9.5px
  // and its advance ≈ 0.6em ≈ 5.7 user units. Anchored at PL - 8 and growing
  // leftward; the `∀` overlay sits at x=4. This is the arithmetic behind
  // ID_MAX, kept here so a later widening of the gutter or a change of face
  // fails loudly rather than reintroducing a strikethrough on every
  // unrestricted row.
  //
  // **The advance follows the TOKEN, not a remembered pixel size.** It read
  // 6.6 — derived from 11px — until 2026-08-28, when the chart faces were
  // restored to their pre-repaint values behind dedicated tokens. That made
  // this constant conservative rather than wrong, which is the quiet failure
  // mode: the assertion kept passing with more headroom than it claimed to be
  // measuring, and nothing said the number no longer described the thing it
  // came from.
  const idMax = /const ID_MAX = (\d+);/.exec(decaySource);
  assert.ok(idMax, 'decay.js no longer truncates its id labels');
  const anchoredAt = 214 - 8;
  const leftEdge = anchoredAt - Number(idMax[1]) * 5.7;
  assert.ok(leftEdge > 12,
    `a ${idMax[1]}-character label starts at ${leftEdge.toFixed(1)} and the ∀ overlay occupies `
    + '4 to ~11 — every unrestricted row would render with a glyph struck through its id');
});

/* -------------------------------------------------------------------------- *
 * The heatstrip.
 * -------------------------------------------------------------------------- */

const NOW = new Date('2026-08-23T09:15:00.000Z');

test('heatSince is UTC midnight of the strip\'s first cell, not a clock-time span', async () => {
  const { heatSince, HEAT_DAYS } = await decayModule();
  assert.equal(HEAT_DAYS, 90, 'the card\'s own title is "90-day delivery"');
  assert.equal(heatSince(NOW), '2026-05-26',
    'ninety cells ending today means the ninetieth day back is the first, at UTC midnight — a '
    + 'clock-time bound would drop whatever happened on that day before this morning');
});

test('heatRows draws ninety cells per row whatever the log holds', async () => {
  const { heatRows, HEAT_DAYS } = await decayModule();
  const rows = heatRows([{ at: '2026-08-23T01:00:00.000Z', injected: [{ id: 'RULE-a' }] }], NOW);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.cells.length, HEAT_DAYS);
  assert.equal(rows[0]!.cells.at(-1), 'h3', 'today is the last cell, and it is the card\'s busiest');
  assert.deepEqual([...new Set(rows[0]!.cells.slice(0, -1))], [null],
    'every other day is empty — "an empty cell is a day nothing happened"');
});

test('heatRows buckets by UTC day, so two records either side of local midnight share a cell', async () => {
  const { heatRows } = await decayModule();
  const rows = heatRows([
    { at: '2026-08-22T00:00:00.000Z', injected: [{ id: 'RULE-a' }] },
    { at: '2026-08-22T23:59:59.000Z', injected: [{ id: 'RULE-a' }] },
    { at: '2026-08-23T00:00:00.000Z', injected: [{ id: 'RULE-a' }] },
  ], NOW);
  const lit = rows[0]!.cells.map((c, i) => [i, c]).filter(([, c]) => c !== null);
  assert.equal(lit.length, 2, 'three records over two UTC days is two lit cells');
  assert.deepEqual(lit.map(([, c]) => c), ['h3', 'h2'],
    'two deliveries then one, against a card maximum of two');
});

test('heatRows draws a spilled day as spilled even when the same day delivered', async () => {
  const { heatRows } = await decayModule();
  // The distinction the whole card exists for: "the one view that separates
  // 'quiet' from 'selected and thrown away repeatedly'". A day that delivered
  // once and spilled three times is not a quiet day drawn in gold.
  const rows = heatRows([
    {
      at: '2026-08-23T01:00:00.000Z',
      injected: [{ id: 'RULE-a' }],
      spilled: [{ id: 'RULE-a' }, { id: 'RULE-a' }, { id: 'RULE-a' }],
    },
  ], NOW);
  assert.equal(rows[0]!.cells.at(-1), 'sp');
});

test('heatRows ranks on both roles, so the item that spills more than it lands is not dropped', async () => {
  const { heatRows } = await decayModule();
  const records: RecordLike[] = [
    { at: '2026-08-23T01:00:00.000Z', injected: [{ id: 'RULE-quiet' }, { id: 'RULE-quiet' }] },
    {
      at: '2026-08-23T02:00:00.000Z',
      injected: [{ id: 'RULE-thrashing' }],
      spilled: [{ id: 'RULE-thrashing' }, { id: 'RULE-thrashing' }, { id: 'RULE-thrashing' }],
    },
  ];
  const rows = heatRows(records, NOW, 90, 1);
  assert.deepEqual(rows.map((r) => r.id), ['RULE-thrashing'],
    'ranking on deliveries alone drops exactly the row a reader opened this card for');
});

test('heatRows ignores a record outside the window and a timestamp it cannot read', async () => {
  const { heatRows } = await decayModule();
  const rows = heatRows([
    { at: '2020-01-01T00:00:00.000Z', injected: [{ id: 'RULE-ancient' }] },
    { at: 'not a date', injected: [{ id: 'RULE-broken' }] },
    { at: '2026-08-23T01:00:00.000Z', injected: [{ id: 'RULE-live' }] },
  ], NOW);
  assert.deepEqual(rows.map((r) => r.id), ['RULE-live']);
});

test('heatLevel bands a day against the card\'s own busiest day, and zero wears no class', async () => {
  const { heatLevel } = await decayModule();
  assert.equal(heatLevel(0, 40), 0, 'an empty cell is a day nothing happened');
  assert.equal(heatLevel(3, 0), 0, 'no maximum means no scale, and no scale means no claim');
  assert.equal(heatLevel(40, 40), 3, 'the busiest day in the card is always the darkest cell');
  assert.equal(heatLevel(1, 40), 1);
  assert.equal(heatLevel(20, 40), 2);
  assert.equal(heatLevel(27, 40), 3);
  for (let count = 1; count <= 40; count += 1) {
    const level = heatLevel(count, 40);
    assert.ok(level >= 1 && level <= 3, `heatLevel(${count}, 40) = ${level}, outside .h1-.h3`);
  }
});

/* -------------------------------------------------------------------------- *
 * The sources, and the one the design of record rules out.
 * -------------------------------------------------------------------------- */

test('the heatstrip is read from audit.at, which is the source dec.heatn names on screen', async () => {
  const { AUDIT_LIMIT } = await decayModule();
  // `dec.heatn`, drawn under this very card: "Its source is not the ledger,
  // which records deliveries only: it is audit_item.role joined to audit.at,
  // both indexed, with the since / until filters that already ship." The
  // request is asserted against that sentence, not against a remembered shape.
  assert.match(decaySource, /\/api\/ask\/audit\?kind=injection&since=\$\{heatSince\(now\)\}/,
    'the strip no longer asks the audit projection for injection records since a UTC day');
  assert.match(decaySource, new RegExp(`limit=\\$\\{AUDIT_LIMIT\\}`));
  assert.equal(AUDIT_LIMIT, 2000, 'the endpoint\'s own ceiling, so the window is as deep as it goes');
  // The one approximation the plan refuses by name: "must not be approximated
  // from the ledger — a heatstrip with no hatching is the 'quiet' reading of a
  // corpus". `series` is the ledger, and it must reach the comb and nothing else.
  assert.equal((decaySource.match(/\.series\b/g) ?? []).length, 1,
    'the ledger series is read more than once. There is one legitimate read of it on this screen '
    + '— the comb\'s ordinal — and a second is the heatstrip reaching for the wrong source.');
  const heat = decaySource.slice(decaySource.indexOf('async function drawHeat'));
  assert.ok(!/\.series\b/.test(heat) && !heat.includes('/api/decay'),
    'the heatstrip touches /api/decay\'s `series`. The ledger records deliveries only, so every '
    + 'spilled day would come back unhatched — which asserts the opposite of what the view exists '
    + 'to show.');
});

test('the comb reads the report and the published session order, and asks for neither twice', async () => {
  assert.match(decaySource, /ctx\.api\('\/api\/decay'\)/);
  assert.match(decaySource, /ctx\.api\('\/api\/sessions'\)/);
  assert.equal((decaySource.match(/ctx\.api\(/g) ?? []).length, 3,
    'the screen makes three reads: the report, the session order, and the audit window. A fourth '
    + 'is a source nobody has justified; a second call to one of these is an N+1 in a screen.');
});

test('the geometry is the mockup\'s geometry, number for number', async () => {
  const { W, HEAT_DAYS } = await decayModule();
  const comb = mockupScript('renderComb');
  const box = /const W=(\d+),H=(\d+),PL=(\d+),PR=(\d+),PT=(\d+),PB=(\d+)/.exec(comb);
  assert.ok(box, 'renderComb no longer declares its box in one line');
  const [, w, h, pl, pr, pt, pb] = box.map(Number);
  assert.equal(W, w);
  // The mockup's H is kept as a FLOOR, and its per-row height falls out of the
  // ten sample rows it draws — so a ten-row corpus renders the design of
  // record's own chart and a fifty-row corpus grows rather than crushing.
  assert.match(decaySource, new RegExp(`const H_MIN = ${h};`));
  assert.match(decaySource, new RegExp(`const ROW = \\(H_MIN - PT - PB\\) / 10;`));
  for (const [name, value] of [['PL', pl], ['PR', pr], ['PT', pt], ['PB', pb]]) {
    assert.match(decaySource, new RegExp(`const ${name} = ${value};`),
      `${name} drifted from the mockup's ${value}`);
  }
  const heat = mockupScript('renderHeat');
  const days = /for\(let d=0;d<(\d+);d\+\+\)/.exec(heat);
  assert.ok(days, 'renderHeat no longer loops over its days');
  assert.equal(HEAT_DAYS, Number(days[1]));
});

/* -------------------------------------------------------------------------- *
 * The screen against the two string tables and against the mockup.
 * -------------------------------------------------------------------------- */

async function table(language: string): Promise<Record<string, string>> {
  const file = path.join(PUBLIC, 'strings', `${language}.js`);
  const mod = await import(pathToFileURL(file).href) as { strings: Record<string, string> };
  return mod.strings;
}

/** Every key `decay.js` names, by the shapes a screen can name one in. */
function keysNamed(): { key: string; args: string | null }[] {
  const out: { key: string; args: string | null }[] = [];
  for (const m of decaySource.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) {
    const after = decaySource.slice(m.index + m[0].length);
    const open = after.indexOf('{');
    const close = after.indexOf(')');
    out.push({ key: m[1]!, args: open !== -1 && (close === -1 || open < close) ? after : null });
  }
  for (const m of decaySource.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'\)/g)) {
    for (const key of [m[1]!, m[2]!, m[3]!]) out.push({ key, args: null });
  }
  // The legend's five entries name their keys inside a literal table, which
  // the `ctx.t('…')` pattern above cannot see.
  for (const m of decaySource.matchAll(/\['(?:i|span)', '[a-z]+', (?:null|'.'), '([^']+)'\]/g)) {
    out.push({ key: m[1]!, args: null });
  }
  // `helpDisclosure(ctx, 'help.whyCold', ...)` — the summary key is the
  // disclosure's own first argument, not a bare `ctx.t()` call, since
  // `lib/disclosure.js` makes that call itself.
  for (const m of decaySource.matchAll(/helpDisclosure\(ctx, '([^']+)'/g)) {
    out.push({ key: m[1]!, args: null });
  }
  return out;
}

test('every string key the Decay screen names is declared in both tables, with its slots supplied', async () => {
  const en = await table('en');
  const he = await table('he');
  const used = keysNamed();

  // A scanner that finds nothing reads exactly like a clean file.
  assert.ok(used.length >= 11,
    `the scan found ${used.length} key(s) in decay.js; the screen names eleven. A collapse means `
    + 'the patterns stopped matching, not that the screen stopped naming keys.');

  // The grammar has ONE parser and this is it. Eight files used to carry a
  // private scanner instead, all of them predating emphasis, and every one
  // read `{b:` as a substitution named `b:...` the day emphasis landed.
  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  for (const { key, args } of used) {
    assert.ok(key in en, `decay.js names ${key}, missing from the English table`);
    assert.ok(key in he, `decay.js names ${key}, missing from the Hebrew table`);
    // Both tables, not only English: `t()` throws on a substitution the caller
    // did not pass, and it throws in whichever language the reader chose.
    for (const template of [en[key]!, he[key]!]) {
      for (const slot of slotsOf(template)) {
        assert.ok(args !== null && args.includes(`${slot}:`),
          `${key} declares a {${slot}} slot that the call site does not supply — t() throws and `
          + 'the screen blanks');
      }
    }
  }
});

test('every dec. key the English table declares is placed by the screen', async () => {
  const en = await table('en');
  const declared = Object.keys(en).filter((key) => key.startsWith('dec.')).sort();
  const named = new Set(keysNamed().map((u) => u.key));
  // The other direction of the same fact. `strings-parity` proves the two
  // tables agree with the mockup's `data-t` set; it cannot prove the screen
  // ever draws one. A key declared for this screen and placed nowhere is a
  // sentence of the design of record that silently does not render — which is
  // what the five legend keys were before this screen had a legend.
  assert.deepEqual(declared.filter((key) => !named.has(key)), [],
    'these dec. keys are declared and drawn nowhere');
  assert.equal(declared.length, 12,
    `the English table declares ${declared.length} dec. key(s); it has been 12 since this screen `
    + 'was written. A new one is a new sentence on this screen and needs placing.');
});

test('no translated string is assigned, and no style attribute is written', async () => {
  // `t()` returns Node[]. Assigning one to `textContent` renders `[object
  // Object]`; assigning `tFlat()` to `innerHTML` would destroy the `.m` spans
  // that carry the direction isolation. Neither is reachable by any other
  // test: this module's DOM half is never evaluated.
  assert.ok(!/textContent\s*=\s*ctx\.t/.test(decaySource),
    'a translated value is assigned to textContent');
  assert.ok(!/innerHTML/.test(decaySource), 'innerHTML has no legitimate use in a screen module');
  assert.ok(/\.append\(\.\.\.ctx\.t\(/.test(decaySource),
    'the screen appends no translated nodes at all — the scan above is checking nothing');
  // The server sends `style-src 'self'` with no `'unsafe-inline'`, so a
  // `style="…"` attribute is blocked outright. Every declaration this screen
  // sets goes through the CSSOM, which CSP does not gate.
  assert.ok(!/setAttribute\(\s*'style'/.test(decaySource),
    'a style attribute is written — the shipped CSP blocks it and the mark would not be styled');
  assert.ok(/\.style\.setProperty\(/.test(decaySource),
    'the screen sets no declaration at all — the scan above is checking nothing');
});

test('the chart declares the inline direction its anchor flip assumes', async () => {
  // The mockup mirrors a chart by projecting x AND flipping `text-anchor`
  // (`ANC`). That flip is only correct in an LTR inline direction: SVG
  // resolves `text-anchor:start` against `direction`, so an `<svg>` that
  // inherited `rtl` from `<html dir>` flips the anchors a second time and
  // every start/end-anchored label lands on the wrong side of its own point.
  // Measured in Hebrew before this line existed — the id gutter was empty and
  // the labels sat over the teeth.
  assert.match(decaySource, /style\.setProperty\('direction', 'ltr'\)/,
    'the comb no longer declares direction:ltr on its chart root; in Hebrew its anchor flip is '
    + 'now a double flip');
  assert.match(decaySource, /const anchor = \(a\) => \(rtl \?/,
    'the screen no longer flips its anchors, so the declaration above is protecting nothing');
});

test('the screen invents no class the mockup\'s own decay section does not use', async () => {
  const section = mockupSection();
  const drawn = new Set<string>();
  for (const m of section.matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1]!.trim().split(/\s+/)) drawn.add(token);
  }
  // **The markup is only half the design of record for this screen.** Both
  // plates are filled in script, so `.hstrip`, `.hname` and `.heataxis` never
  // appear in an attribute — `renderHeat` writes them into `el()` calls, and
  // `renderComb` writes `.axis`, `.never` and `.mono` into SVG attribute
  // objects. Scanning the section alone would call every one of them invented.
  for (const source of [mockupScript('renderComb'), mockupScript('renderHeat')]) {
    for (const m of source.matchAll(/\bel\('[a-z0-9]+','([a-z0-9 ]+)'/g)) {
      for (const token of m[1]!.trim().split(/\s+/)) drawn.add(token);
    }
    for (const m of source.matchAll(/\bclass:'([a-z0-9 ]+)'/g)) {
      for (const token of m[1]!.trim().split(/\s+/)) drawn.add(token);
    }
  }
  for (const token of ['hstrip', 'hname', 'heataxis', 'axis', 'never', 'mono']) {
    assert.ok(drawn.has(token),
      `the mockup's own script no longer draws "${token}" — the extraction above is broken, or `
      + 'the design of record moved');
  }
  assert.ok(drawn.size >= 10, `the mockup scan found ${drawn.size} class token(s) — too few to be `
    + 'the decay section, so the extraction is broken rather than the screen clean');

  const written: string[] = [];
  for (const m of decaySource.matchAll(/\bel\('[a-z0-9]+', '([^']*)'/g)) written.push(m[1]!);
  assert.ok(written.length >= 8,
    `the decay.js scan found ${written.length} class string(s); the screen writes at least eight`);
  for (const value of written) {
  const allowed = allowedClasses(drawn);
    for (const token of value.trim().split(/\s+/)) {
      // `allowed`, not `drawn`: the mockup's classes UNION what styles.css
      // actually styles. See test/helpers/shipped-classes.ts — the app is what
      // gets built now, so a NEW class with a real rule is ordinary development;
      // a typo still has no rule anywhere and still fails here.
      assert.ok(allowed.has(token),
        `decay.js writes class "${token}", which <section data-p="decay"> never uses. A class the `
        + 'design of record does not draw is either a typo or a decision the owner has not taken.');
    }
  }

  // The composite the whole second card turns on, pinned as a whole attribute
  // value rather than as two loose tokens: a plate that took `plate` without
  // `heat` would satisfy the token check above and draw ninety cells in a
  // column.
  assert.ok(section.includes('class="heat plate"'),
    'the mockup no longer draws class="heat plate" — the design of record moved');
  assert.ok(written.includes('heat plate'),
    'decay.js no longer writes the "heat plate" pair the mockup draws');

  // The cell classes live in the strip builder rather than in an `el()` call
  // with a literal, so they are checked against the STYLESHEET's own rules —
  // which is where a cell that wears a class nobody styles would show up.
  const css = readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
  for (const cell of ['h1', 'h2', 'h3', 'sp']) {
    assert.ok(css.includes(`.hstrip i.${cell}{`),
      `styles.css has no rule for .hstrip i.${cell}, so a cell wearing it draws as an empty day`);
  }
});
