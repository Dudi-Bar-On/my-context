/**
 * The powerline bar: the segments, the derived bands, the escapes, and the
 * three ways it degrades.
 *
 * **Nothing here installs anything.** Every assertion is over a STRING this
 * process rendered, or over a temp directory this file made and removed. No
 * settings file, no `~/.claude`, nothing `test/helpers/real-home-guard.ts`
 * would have to catch — which is also why this file needs no HOME redirect and
 * imports its module statically.
 *
 * **The band pin is the point of this file.** The colour of the last block is
 * not allowed to be a decision made in `statusline-powerline.ts`; it has to be
 * the web strip's own `occupancyLevel`, over the web strip's own
 * `CONTEXT_SAMPLE_FRESH_MS`. So the tests below never assert "88.2 is warn" —
 * they load `src/ui/public/lib/viewmodel.js` the way `test/ui/viewmodel.test.ts`
 * does and assert that the two ANSWER THE SAME, at boundaries derived from
 * whatever that module currently says. A boundary moved there moves these tests
 * with it; a boundary copied into the CLI fails them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  ASK_GLYPH, FIELD_JOIN, FIELD_SEP,
  DEFAULT_EFFORT, ELLIPSIS_SEGMENT, GIVE, LEVEL_GLYPH, LEVEL_SOURCE, NO_EXTRAS,
  PALETTE, LEVEL_ICON, usageBar, usageLevelOf,
  absoluteFillLevel, askSegment, bandsAreDerived, bandsFor, buildSegments, colourAllowed,
  fillBands,
  contextSegment, displayWidth, fitSegments, freshMs, gitBranch, levelFor, modelSegment,
  payloadExtras, rateLimitSegment, renderPowerline, until, centreOffset, segmentWidth,
  usageBands,
  BAR_FILL,
  buildLines, renderStatusLine, FOCUS_MAX, lastAuditSegment, since, stamp,
  type ModelModes, type PowerlineInput, type Segment,
} from '../../src/cli/commands/statusline-powerline.ts';

/**
 * The browser module the bands come from, loaded here the same way the UI's
 * own test loads it: a URL specifier, because these files are deliberately
 * untyped and outside `tsconfig.json`, and because a relative specifier does
 * not survive a Windows path.
 */
interface BandModule {
  occupancyBands: (threshold: unknown) => { warn: number; crit: number } | null;
  occupancyLevel: (pct: unknown, threshold: unknown, ageMs: unknown) => string | null;
  CONTEXT_SAMPLE_FRESH_MS: number;
  OCCUPANCY_WARN_FRACTION: number;
  fillLevel: (pct: unknown, ageMs: unknown) => string | null;
  CONTEXT_FILL_WARN_PERCENT: number;
  CONTEXT_FILL_CRIT_PERCENT: number;
}
const web = (await import(LEVEL_SOURCE)) as BandModule;

const THRESHOLD = 98;

/**
 * The absolute boundaries, read from the module that declares them.
 *
 * Never written down here. Every assertion below that needs "just under warn"
 * or "exactly at crit" computes it from these, so a boundary moved in
 * `lib/viewmodel.js` moves the probes with it rather than leaving them on the
 * old side of a line that has shifted.
 */
const FILL_WARN = web.CONTEXT_FILL_WARN_PERCENT;
const FILL_CRIT = web.CONTEXT_FILL_CRIT_PERCENT;

function input(over: Partial<PowerlineInput>): PowerlineInput {
  return {
    ...NO_EXTRAS,
    model: 'Opus 5',
    project: 'test_mycontext_plugin',
    branch: 'campaign/my-context-test',
    occupancy: { state: 'known', percent: 42, ageMs: 0, usedTokens: Math.round((42) * 10_000), windowSize: 1_000_000 },
    threshold: THRESHOLD,
    myctx: null,
    focus: null,
    lastAudit: null,
    myctxNote: null,
    teeNote: null, corpus: null,
    ...over,
  };
}

/**
 * **A FIXED `now`, since the bar gained a wall CLOCK on 2026-09-02.**
 *
 * Every verbatim expectation in this file would otherwise be a race against
 * the minute boundary. `NOW` is declared further down and read by name by
 * several tests, so it is not moved; this is the same instant under a name the
 * helper can see, and `stamp(AT)` is what the expectations quote — never a
 * date written out here, which would pin the FORMAT in a second place.
 */
const AT = Date.UTC(2026, 7, 31, 12, 0, 0);

function line(over: Partial<PowerlineInput>, colour = false, columns: number | null = null): string {
  return renderPowerline(buildSegments(input(over), AT), { colour, columns });
}

/**
 * The context block's ink — the FILL, which is absolute.
 *
 * `threshold` is still a parameter and is still passed by the callers below,
 * and it is deliberately ignored: several tests assert that moving it does
 * not move this, and a signature that could not take it could not say so.
 */
function ctxInk(percent: number, ageMs = 0, _threshold: number | null = THRESHOLD): number {
  return contextSegment({ state: 'known', percent, ageMs, usedTokens: Math.round(percent * 10_000), windowSize: 1_000_000 }).ink.fg;
}

/* -------------------------------------------------------------------- *
 * The bands are DERIVED, not chosen.                                    *
 * -------------------------------------------------------------------- */

test('the CLI reaches the web strip\'s own band logic — and says so when it cannot', () => {
  // If this is ever false the rest of this file is asserting about a fallback,
  // so it is named first rather than left to make three other tests confusing.
  assert.equal(bandsAreDerived(), true, `${LEVEL_SOURCE} did not load`);
  assert.deepEqual(bandsFor(THRESHOLD), web.occupancyBands(THRESHOLD));
  assert.equal(freshMs(), web.CONTEXT_SAMPLE_FRESH_MS);
});

test('levelFor is occupancyLevel — the same answer at every boundary the web derives', () => {
  for (const threshold of [98, 80, 50, 12.5]) {
    const bands = web.occupancyBands(threshold);
    assert.ok(bands !== null);
    // The figures are computed FROM the bands, so a warn fraction changed in
    // viewmodel.js moves the probes rather than leaving them on the old side
    // of a boundary that has moved out from under them.
    const probes = [
      0, bands.warn - 0.1, bands.warn, bands.warn + 0.1,
      bands.crit - 0.1, bands.crit, bands.crit + 0.1, 100,
    ];
    for (const pct of probes) {
      assert.equal(
        levelFor(pct, threshold, 0), web.occupancyLevel(pct, threshold, 0),
        `${pct}% against a threshold of ${threshold} is banded differently in the terminal `
        + 'than in the browser — which is the same reader being given two verdicts about '
        + 'one number',
      );
    }
    // Past the freshness window, both refuse to band at all.
    assert.equal(levelFor(bands.crit, threshold, web.CONTEXT_SAMPLE_FRESH_MS + 1), 'stale');
  }
});

test('no threshold and no band are spelled in the CLI module at all', () => {
  // A SILENCE AUDIT, not a style check. The failure this project has shipped
  // seven times is a hand-kept number that must agree with a derived one, and
  // the way it gets in is somebody writing `98` "just for the default". The
  // module's own bytes are the only place that can be checked.
  const source = readFileSync(
    new URL('../../src/cli/commands/statusline-powerline.ts', import.meta.url), 'utf8',
  );
  const code = source
    // Prose is exempt: the doc comments explain the derivation and have to be
    // able to name the numbers they are explaining.
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /\b98\b/, 'the default threshold is config.ts\'s, never this file\'s');
  assert.doesNotMatch(code, /0\.9\b/, 'the warn fraction is viewmodel.js\'s, never this file\'s');
  assert.doesNotMatch(code, /15\s*\*\s*60/, 'the freshness window is context-occupancy.ts\'s');
  // And no COMPARISON against a bare number, which is where a band actually
  // hides: `pct >= 88.2` is the defect, not the digits themselves (the
  // palette is full of legitimate ones). `0` and `1` are exempt — they are
  // emptiness and singularity, not thresholds. The two absolute bands pass
  // because they are compared BY NAME, which is the whole seam.
  const compared = (code.match(/[<>]=?\s*[0-9]+(?:\.[0-9]+)?/g) ?? [])
    .map((m) => m.replace(/[^0-9.]/g, ''))
    .filter((n) => n !== '0' && n !== '1');
  assert.deepEqual(
    compared, [],
    'a percentage compared against a literal is a band this file decided for itself',
  );
});

/* -------------------------------------------------------------------- *
 * Four states, four renderings.                                         *
 * -------------------------------------------------------------------- */

test('the absolute fill bands are the web strip\'s own, not a copy of them', () => {
  // This was a tripwire for one afternoon: the ruling arrived before
  // `lib/viewmodel.js` exported anything absolute, so the two boundaries were
  // restated in the CLI under a test that failed the moment they landed. They
  // landed, it failed, and this is what it promised to become.
  assert.deepEqual(fillBands(), { warn: FILL_WARN, crit: FILL_CRIT });

  // And the predicate, not just the numbers: the same answer at every
  // boundary the web module draws, including the one that is not a band.
  const probes = [
    0, FILL_WARN - 0.1, FILL_WARN, FILL_WARN + 0.1,
    FILL_CRIT - 0.1, FILL_CRIT, FILL_CRIT + 0.1, 100,
  ];
  for (const pct of probes) {
    for (const age of [0, web.CONTEXT_SAMPLE_FRESH_MS, web.CONTEXT_SAMPLE_FRESH_MS + 1]) {
      assert.equal(
        absoluteFillLevel(pct, age), web.fillLevel(pct, age),
        `${pct}% at ${age}ms old is filled differently in the terminal than in the browser`,
      );
    }
  }

  // The CLI reads them BY NAME and declares neither. Checking for the digits
  // themselves is what the first draft of this did, and it is wrong: 60 is also
  // a `GIVE` rank and a minute, and a test that cannot tell a band from a
  // minute is a test that will be deleted the first time it fires wrongly. The
  // silence audit that DOES catch a smuggled band is the comparison scan in
  // `no threshold and no band are spelled in the CLI module at all`.
  const source = readFileSync(
    new URL('../../src/cli/commands/statusline-powerline.ts', import.meta.url), 'utf8',
  );
  assert.match(source, /CONTEXT_FILL_WARN_PERCENT/, 'the warn boundary is read by name');
  assert.match(source, /CONTEXT_FILL_CRIT_PERCENT/, 'the crit boundary is read by name');
  assert.doesNotMatch(
    source, /ABSOLUTE_(WARN|CRIT)_PERCENT|SEAM ─ THE ABSOLUTE FILL BANDS/,
    'the restated constants and their seam are gone, not merely unused',
  );
});

test('the fill is absolute — the same verdict whatever anybody configured', () => {
  assert.equal(absoluteFillLevel(0), 'ok');
  assert.equal(absoluteFillLevel(FILL_WARN - 0.1), 'ok');
  assert.equal(absoluteFillLevel(FILL_WARN), 'warn');
  assert.equal(absoluteFillLevel(FILL_CRIT - 0.1), 'warn');
  assert.equal(absoluteFillLevel(FILL_CRIT), 'crit');
  assert.equal(absoluteFillLevel(100), 'crit');
  assert.equal(absoluteFillLevel(Number.NaN), null);

  // THE POINT OF THE RULING: the threshold moves and the fill does not. With
  // the ask at 98 the old single-band answer stayed green until 88.2%, which is
  // the divergence this split exists to end.
  for (const threshold of [null, 50, 85, 98]) {
    assert.equal(
      ctxInk(70, 0, threshold), PALETTE['warn']?.fg,
      '70% is amber whatever the handover threshold is',
    );
    assert.equal(ctxInk(90, 0, threshold), PALETTE['crit']?.fg);
    assert.equal(ctxInk(10, 0, threshold), PALETTE['ok']?.fg);
  }
});

test('the context block changes colour as the window fills, and carries an icon too', () => {
  // ── FOUR BANDS SINCE THE OWNER'S RULING OF 2026-09-01, not three ──────────
  // This test used to read `FILL_WARN`/`FILL_CRIT` — the web's absolute pair —
  // because the block had two boundaries. The used-of-maximum ruling gives it
  // three, and they are `USAGE_*`'s until phase 2 moves them to viewmodel.js.
  const safe = ctxInk(BANDS.caution - 0.1);
  const caution = ctxInk(BANDS.caution);
  const warning = ctxInk(BANDS.warning);
  const critical = ctxInk(BANDS.critical);
  const stale = contextSegment({ state: 'unmeasurable', why: 'stale' }).ink.fg;

  assert.equal(new Set([safe, caution, warning, critical, stale]).size, 5,
    'five states, five hues — four bands and the one that is not a band');
  assert.equal(safe, PALETTE['ok']?.fg);
  assert.equal(caution, PALETTE['gold']?.fg);
  assert.equal(warning, PALETTE['warn']?.fg);
  assert.equal(critical, PALETTE['crit']?.fg);
  assert.equal(stale, PALETTE['neutral']?.fg);

  // A glyph AND a colour AND a name, the web strip's own rule and its own four
  // glyphs. Colour is never the only carrier: --warn and --crit are one state
  // to a dichromat and one grey on a mono terminal.
  const text = (percent: number): string => contextSegment({
    state: 'known', percent, ageMs: 0,
    usedTokens: Math.round(percent * 10_000), windowSize: 1_000_000,
  }).text;
  // An ICON and a colour and a name. `safe` carries no icon on purpose — a
  // calm bar is quiet — so the carrier there is the word and the number, which
  // are present at every level.
  assert.ok(text(10).startsWith(BAR_FILL), 'safe leads with the bar, not an icon');
  assert.ok(text(65).startsWith(`${LEVEL_ICON.caution} `));
  assert.ok(text(75).startsWith(`${LEVEL_ICON.warning} `));
  assert.ok(text(90).startsWith(`${LEVEL_ICON.critical} `));
  assert.match(
    contextSegment({ state: 'unmeasurable', why: 'stale' }).text,
    new RegExp(`^${LEVEL_GLYPH.neutral} ctx `),
  );
  assert.equal(new Set(Object.values(LEVEL_ICON)).size, 4, 'four icons, all different');

  // The other blocks do not move with it: ONE block changes as the window
  // fills and the rest are untouched. Until 2026-08-31 that block was the last
  // one and this test compared every block but the last; since the owner
  // centred the context figure it is the ANCHOR, so the comparison is now
  // "every block that is not the anchor" — the same claim, addressed by role
  // rather than by position, which is what stops it silently weakening the
  // next time the layout moves.
  //
  // `threshold: null` in both, because crossing the ask deliberately changes
  // the ask block too, and that is asserted in its own test rather than
  // quietly folded into this one.
  const notAnchor = (segs: Segment[]): Segment[] => segs.filter((seg) => seg.anchor !== true);
  const anchorOf = (segs: Segment[]): Segment | undefined => segs.find((seg) => seg.anchor === true);
  const calm = buildSegments(input({
    occupancy: { state: 'known', percent: 10, ageMs: 0, usedTokens: Math.round((10) * 10_000), windowSize: 1_000_000 }, threshold: null,
  }));
  const near = buildSegments(input({
    occupancy: { state: 'known', percent: 70, ageMs: 0, usedTokens: Math.round((70) * 10_000), windowSize: 1_000_000 }, threshold: null,
  }));
  assert.deepEqual(notAnchor(calm), notAnchor(near));
  assert.notDeepEqual(anchorOf(calm), anchorOf(near));
  assert.equal(calm.filter((seg) => seg.anchor === true).length, 1, 'exactly one anchor');
});

/**
 * **THE HANDOVER SCALE** — owner ruling, 2026-08-31, candidate "headroom".
 *
 * The block used to be SILENT below the warn band. It now answers "how far am
 * I from the ask" at every fill, as a NUMBER, and collapses to words once the
 * number is spent. The three shapes the owner chose are asserted verbatim.
 */
test('the handover scale answers the distance as a number, at every fill', () => {
  const marker = (percent: number, threshold: number | null): Segment | null =>
    askSegment({ state: 'known', percent, ageMs: 0, usedTokens: Math.round(percent * 10_000), windowSize: 1_000_000 }, threshold);

  for (const threshold of [98, 85, 50]) {
    const bands = web.occupancyBands(threshold);
    assert.ok(bands !== null);
    // ── SUPERSEDED SHAPE, 2026-09-01 ──────────────────────────────────────
    // This block drew the gap as `◆ ask 98 · +56.0` until the owner ruled that
    // every used-of-maximum field takes the same four controls. The maximum
    // here is the THRESHOLD, so the block now draws the same fact as a bar and
    // a proportion, with the two figures in the count pair. What has NOT
    // changed is the ruling this test was written for: the distance is
    // readable at every fill, and it is a NUMBER rather than a picture alone.
    const below = bands.warn - 0.1;
    const shape = (pct: number): string => {
      const ask = Number.isInteger(threshold) ? String(threshold) : threshold.toFixed(1);
      const proportion = (pct / threshold) * 100;
      const icon = LEVEL_ICON[usageLevelOf(proportion)!];
      const lead = icon === '' ? '' : `${icon} `;
      // The gap is printed too, since the owner ruled it back on 2026-09-01:
      // the distance is worth reading at any fill, and a distance the reader
      // has to compute is not one they read at a glance.
      return `${lead}${usageBar(proportion)} ${proportion.toFixed(0)}% `
        + `(${pct.toFixed(1)} / ${ask})`
        + ` ·+${(threshold - pct).toFixed(1)}`;
    };
    assert.equal(marker(below, threshold)?.text, shape(below));
    assert.equal(marker(bands.warn, threshold)?.text, shape(bands.warn));
    // AT the ask the words take over, and they are still the owner's words.
    assert.equal(marker(bands.crit, threshold)?.text, `${ASK_GLYPH} handover due`);

    // The DISTANCE still shrinks as the window fills and is still carried by a
    // figure — it is now the count pair and the proportion that carry it, and
    // both still move. A scale whose numbers did not move would be a
    // decoration, which is what this assertion has always been about.
    assert.equal(marker(threshold - 40, threshold)?.text, shape(threshold - 40));
    assert.equal(marker(threshold - 2, threshold)?.text, shape(threshold - 2));
    const gap = (pct: number): string => marker(pct, threshold)!.text;
    assert.notEqual(gap(threshold - 40), gap(threshold - 2), 'the block did not move');

    // ── THE HUE MOVED, 2026-09-01, AND THE RULE DID NOT ────────────────────
    // Gold went wholly to the `caution` BAND, so this block is no longer gold
    // at any fill; it takes its band's ink below the ask like every other
    // used-of-max field, and `--carry` once the ask has fired. What is
    // unchanged is the rule the old assertion protected: the urgency is
    // carried by WORDS and WEIGHT at the last step, never by a second hue.
    assert.equal(marker(bands.crit, threshold)?.ink.fg, PALETTE['carry']?.fg);
    assert.notEqual(marker(bands.crit, threshold)?.ink.fg, PALETTE['gold']?.fg);
    // `below` sits a tenth of a point under the approach band, which as a
    // PROPORTION of the threshold is 89.9% — `critical` on the used-of-max
    // scale, so it is bold like every other critical block. What the old
    // assertion was protecting is that bold is EARNED rather than worn at
    // every fill, and that is asserted on a genuinely calm figure instead.
    assert.notEqual(marker(threshold * 0.3, threshold)?.bold, true);
    assert.equal(marker(bands.crit, threshold)?.bold, true);
    // The marker glyph survives on the one state that still spends words on
    // itself; below the ask the block's identity is its LABEL, which is the
    // same job done by the same means as every other used-of-max field.
    assert.ok(marker(bands.crit, threshold)?.text.startsWith(ASK_GLYPH));
    for (const pct of [below, bands.warn]) {
      assert.equal(marker(pct, threshold)?.label, 'ASK');
    }
  }

  // THE OWNER'S OWN THREE EXAMPLES, at the threshold in force here — restated
  // in the shape the used-of-maximum ruling gives them. The FACTS are the ones
  // the owner picked: far below the ask, nearly at it, and past it.
  assert.equal(marker(25.1, 85)?.text, '▰▰▰▱▱▱▱▱▱▱ 30% (25.1 / 85) ·+59.9');
  assert.equal(marker(81.8, 85)?.text, '💀 ▰▰▰▰▰▰▰▰▰▰ 96% (81.8 / 85) ·+3.2');
  assert.equal(marker(91.0, 85)?.text, '◆ handover due');

  // THE EARLIER RULING'S EXAMPLE, still true and still worth pinning: the ask
  // is a different question from the fill. At 98 the ask is 18 points away
  // while the fill is already amber; at 85 the same 80% is approaching. The
  // fill does not move with the threshold, and now the DISTANCE says so in
  // numbers rather than by falling silent.
  // The same 80% is 82% of the way to a threshold of 98 and 94% of the way to
  // one of 85 — two different verdicts about the ask — while the FILL is the
  // same fact at both, which is the whole point of the pair.
  assert.equal(marker(80, 98)?.text, '💀 ▰▰▰▰▰▰▰▰▱▱ 82% (80.0 / 98) ·+18.0');
  assert.equal(marker(80, 85)?.text, '💀 ▰▰▰▰▰▰▰▰▰▱ 94% (80.0 / 85) ·+5.0');
  assert.notEqual(marker(80, 98)?.text, marker(80, 85)?.text, 'the ask moved with the threshold');
  assert.equal(ctxInk(80, 0, 98), ctxInk(80, 0, 85), 'and the fill did not');

  // A threshold that is not a whole number keeps its decimal, and the USED
  // figure always carries one. Both now live in the count pair, which is the
  // shape the used-of-maximum ruling gives every such field.
  assert.equal(marker(80, 92.5)?.text, '💀 ▰▰▰▰▰▰▰▰▰▱ 86% (80.0 / 92.5) ·+12.5');

  // No ask configured, no distance to it. No claim about a window that cannot
  // be measured, and none about a fossil.
  assert.equal(marker(100, null), null);
  assert.equal(askSegment({ state: 'unmeasurable', why: 'no-sample' }, 98), null);
  assert.equal(
    askSegment({ state: 'known', percent: 100, ageMs: web.CONTEXT_SAMPLE_FRESH_MS + 1, usedTokens: Math.round((100) * 10_000), windowSize: 1_000_000 }, 98),
    null,
  );

  // And the gold is not one of the fill hues, so the two questions never read
  // as one answer.
  assert.equal(
    new Set([
      PALETTE['gold']?.fg, PALETTE['ok']?.fg, PALETTE['warn']?.fg,
      PALETTE['crit']?.fg, PALETTE['neutral']?.fg,
    ]).size,
    5,
  );
  assert.ok(!Object.values(LEVEL_GLYPH).includes(ASK_GLYPH as never));
});



test('a stale sample says a dash, and the three unmeasurable reasons stay three', () => {
  const said = (why: 'no-bridge' | 'no-sample' | 'unknown-shape' | 'stale'): string =>
    contextSegment({ state: 'unmeasurable', why }).text;

  assert.equal(new Set([said('no-bridge'), said('no-sample'), said('unknown-shape')]).size, 3);
  for (const why of ['no-bridge', 'no-sample', 'unknown-shape', 'stale'] as const) {
    assert.match(
      said(why), new RegExp(`^${LEVEL_GLYPH.neutral} ctx — `),
      'every one of them says a dash rather than a number, under the not-a-level glyph',
    );
    assert.doesNotMatch(said(why), /[0-9]/);
    assert.equal(
      contextSegment({ state: 'unmeasurable', why }).ink.fg,
      PALETTE['neutral']?.fg,
      'an unmeasurable window is never drawn in a band colour',
    );
  }
});

/* -------------------------------------------------------------------- *
 * Degrading honestly.                                                   *
 * -------------------------------------------------------------------- */

test('with colour off it is the same text and not one escape byte', () => {
  const coloured = line({}, true);
  const plain = line({}, false);
  assert.ok(coloured.includes('\u001b['), 'the coloured form does carry escapes');
  assert.ok(!plain.includes('\u001b'), 'never a raw escape into a pipe');
  // "The same text": strip the escapes from the coloured form and the two are
  // the same line. A degradation that also drops a fact is not a degradation.
  assert.equal(coloured.replaceAll(/\u001b\[[0-9;]*m/g, ''), plain);
  // The whole line, verbatim, in the shape the used-of-maximum ruling gives
  // it: both used-of-max fields carry a bar, a proportion and their counts,
  // and neither carries an icon because both are `safe` at 42%.
  // The whole line, verbatim, in the shape the owner's reference fixes: flat
  // text, one `│` between fields, no caps and no arrows.
  assert.equal(plain, ['MODEL Opus 5', 'REPO test_mycontext_plugin',
    'BRANCH campaign/my-context-test',
    `ASK ${usageBar(42 / 98 * 100)} 43% (42.0 / 98) ·+56.0`,
    `WINDOW ${usageBar(42)} 42.0% (420.0k / 1.0M)`,
    // The wall clock closes the bar since 2026-09-02, and it is quoted through
    // `stamp` rather than written out: this file asserts WHICH FIELDS the line
    // carries, and pinning the date's spelling here would put `wallStamp`'s
    // decision in a second place.
    `CLOCK ${stamp(AT)}`,
  ].join(FIELD_JOIN));
});

test('colourAllowed refuses when the user says so, and does not refuse the one pipe that renders', () => {
  assert.equal(colourAllowed({}, true, false), true);
  assert.equal(colourAllowed({ NO_COLOR: '1' }, true, true), false);
  assert.equal(colourAllowed({ NO_COLOR: 'anything' }, true, true), false);
  // An EMPTY NO_COLOR is not a refusal — the convention is a non-empty value,
  // and treating `NO_COLOR=` as "off" would strip colour from every shell that
  // exports an empty placeholder.
  assert.equal(colourAllowed({ NO_COLOR: '' }, true, true), true);
  assert.equal(colourAllowed({ TERM: 'dumb' }, true, true), false);

  // The one that matters: Claude Code hands this command a PIPE and renders
  // the ANSI it gets back. Keying on isTty alone would mean the installed
  // bridge — the only place this line is ever seen — is the one place it is
  // never coloured.
  assert.equal(colourAllowed({}, false, true), true);
  assert.equal(colourAllowed({}, false, false), false, 'a pipe that did not ask gets none');
});

test('a narrow terminal elides the branch from the LEFT and never wraps', () => {
  // 128 columns, and the number has moved THREE times for one reason: the
  // blocks either side of the branch keep growing, so the band in which the
  // branch is SHORTENED rather than given up whole keeps sliding right. It was
  // 60, then 85 when the handover scale added a permanent ~19-cell block, then
  // 120 when the used-of-maximum ruling grew the ask and context blocks, and
  // 128 now that the owner ruled the headroom figure back onto the ask. The
  // one-line form is 140 wide and the elide band runs from about 130 down to
  // about 120. Measured each time, never guessed.
  //
  // The assertion is the one it has always been: the distinguishing tail is
  // the half worth keeping. Only the width it has to be measured at has moved.
  // 168 since the wall clock landed on 2026-09-02: the one-line form grew by
  // its 23 cells, so the band in which the branch is SHORTENED rather than
  // given up whole slid right by exactly that. Measured, as every previous
  // move of this number was.
  const columns = 168;
  const narrow = line({}, false, columns);
  assert.ok(displayWidth(narrow) <= columns, `${displayWidth(narrow)} > ${columns}`);
  // The distinguishing TAIL survives; the leading `…` says a head was removed.
  assert.match(narrow, /BRANCH …[^ ]*-test /, 'the distinguishing TAIL is what survived');
  assert.match(narrow, /WINDOW .*42\.0%/);

  // Every width from very wide to very narrow: the line never exceeds the
  // terminal, and the context block never goes. A bar that wraps costs the
  // user a line of their transcript on every assistant message.
  for (let w = 120; w >= 12; w--) {
    const rendered = line({}, false, w);
    assert.ok(
      displayWidth(rendered) <= w,
      `at ${w} columns the line is ${displayWidth(rendered)} wide: "${rendered}"`,
    );
    assert.match(rendered, /WINDOW .*42\.0%/, `the context block was given up at ${w} columns`);
  }
});

/**
 * **THE CONTEXT BLOCK IS CENTRED WHEN THERE IS ROOM** — owner ruling,
 * 2026-08-31, option (a): centre when it fits, left-to-right when it does not.
 *
 * The ruling replaced "the context block stays LAST" (see `buildSegments` for
 * the record of the supersession) and it came with a condition the owner was
 * explicit about: **no field is spent to buy the position**. Both halves are
 * asserted here, and the second is the one worth guarding — a centring that
 * quietly dropped a block to make itself fit would be exactly the failure this
 * whole bar exists not to have.
 */
function centredInput(): PowerlineInput {
  // Balanced on purpose: identity to the left of the anchor, disclosures and
  // windows to its right. A left-heavy bar cannot be centred at any width, and
  // that case has its own assertion below.
  return input({
    model: 'Opus 5',
    project: 'proj',
    branch: 'main',
    occupancy: { state: 'known', percent: 42, ageMs: 0, usedTokens: Math.round((42) * 10_000), windowSize: 1_000_000 },
    threshold: 98,
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
    costUsd: 0.42,
    elapsedMs: null,
    warmPercent: 99.1,
    sevenDay: { usedPercent: 49, resetsAt: null },
    fiveHour: { usedPercent: 12, resetsAt: null },
  });
}

/** Where the anchor's middle falls, counted the way `widthOf` counts. */
function anchorMidpoint(fitted: Segment[]): number {
  const at = fitted.findIndex((seg) => seg.anchor === true);
  assert.ok(at >= 0, 'the bar has an anchor');
  // The same units `widthOf` counts, and they moved with the frame: no
  // opening cap, no per-field padding, and ` │ ` between neighbours.
  let start = 0;
  for (let i = 0; i < at; i++) start += segmentWidth(fitted[i]!) + 3;
  return start + segmentWidth(fitted[at]!) / 2;
}

/**
 * The narrowest terminal that can centre this bar, DERIVED rather than typed:
 * wide enough for the whole bar, AND wide enough that the anchor's own
 * midpoint reaches the middle. Both bind, and which one binds depends on how
 * the blocks are balanced — so a block that changes width moves this number
 * with it instead of leaving a stale literal in the test.
 */
function widthThatCentres(segs: Segment[]): number {
  const whole = displayWidth(renderPowerline(segs, { colour: false, columns: null }));
  const mid = anchorMidpoint(segs);
  // TWICE THE LONGER HALF. The indent can only push the bar to the right, so
  // the terminal has to be wide enough for the heavier side of the anchor to
  // sit in half of it — `2 x max(left, right)`, the same arithmetic the lane
  // report gave the owner for "how wide before this centres". Plus one,
  // because at exactly that width the slack is zero, and an indent of zero is
  // the fallback rather than the centred case.
  return Math.ceil(Math.max(mid * 2, (whole - mid) * 2)) + 1;
}

test('the context block lands on the terminal centre when the width allows it', () => {
  const full = centredInput();
  const segs = buildSegments(full, NOW);
  const enough = widthThatCentres(segs);

  for (const columns of [enough, enough + 20, enough + 100]) {
    const fitted = fitSegments(segs, columns);
    const offset = centreOffset(fitted, columns);
    assert.ok(offset > 0, `expected an indent at ${columns} columns`);
    // Within half a cell of the terminal's centre — the rounding of an odd
    // width, and nothing else.
    assert.ok(
      Math.abs(offset + anchorMidpoint(fitted) - columns / 2) <= 1,
      `at ${columns} the anchor midpoint is ${offset + anchorMidpoint(fitted)}, centre is ${columns / 2}`,
    );
    const rendered = renderPowerline(segs, { colour: false, columns });
    assert.ok(rendered.startsWith(`${' '.repeat(offset)}MODEL`), 'the indent is plain spaces');
    assert.ok(displayWidth(rendered) <= columns, 'and it still never exceeds the terminal');
  }
});

test('centring never costs a block — the same width shows the same blocks either way', () => {
  const full = centredInput();
  const segs = buildSegments(full, NOW);
  const enough = Math.ceil(anchorMidpoint(segs) * 2);

  // The owner's condition, stated as a test: at every width, what the bar
  // SHOWS is decided by `fitSegments` alone, and the indent is applied to
  // whatever survived. Centring can therefore never be the reason a field went.
  for (let columns = enough + 40; columns >= 12; columns--) {
    const fitted = fitSegments(segs, columns);
    const rendered = renderPowerline(segs, { colour: false, columns });
    for (const seg of fitted) {
      assert.ok(
        rendered.includes(seg.text),
        `at ${columns} columns the block "${seg.text}" fitted but was not drawn`,
      );
    }
    assert.ok(displayWidth(rendered) <= columns, `at ${columns} the line is ${displayWidth(rendered)} wide`);
    assert.match(rendered, /WINDOW .*42\.0%/, `the context figure went at ${columns} columns`);
  }
});

test('with no room to centre, the bar starts at column 0 — the ruled fallback', () => {
  const full = centredInput();
  const segs = buildSegments(full, NOW);

  // A terminal exactly as wide as the bar: there is no slack to indent into,
  // so the line runs left-to-right exactly as it did before the ruling.
  const whole = displayWidth(renderPowerline(segs, { colour: false, columns: null }));
  assert.equal(centreOffset(fitSegments(segs, whole), whole), 0, 'no slack, no indent');
  assert.ok(!renderPowerline(segs, { colour: false, columns: whole }).startsWith(' '));

  // **Narrower than that is NOT automatically uncentred, and the test says so
  // rather than pretending otherwise.** Once `fitSegments` gives a block up
  // the bar gets shorter, so a narrow terminal can have slack again and the
  // remaining blocks re-centre in it. What must hold at EVERY width is the
  // pair below: the line never exceeds the terminal, and the indent never
  // pushes it past the right edge.
  for (let columns = whole; columns >= 12; columns--) {
    const fitted = fitSegments(segs, columns);
    const offset = centreOffset(fitted, columns);
    assert.ok(offset >= 0, `a negative indent would crop the left at ${columns}`);
    const rendered = renderPowerline(segs, { colour: false, columns });
    assert.ok(
      displayWidth(rendered) <= columns,
      `at ${columns} the indented line is ${displayWidth(rendered)} wide`,
    );
  }

  // No width to centre IN. Claude Code's pipe does not always report one, and
  // a bar that guessed a terminal size would indent into a wrap.
  assert.equal(centreOffset(fitSegments(segs, null), null), 0);
  assert.ok(!renderPowerline(segs, { colour: false, columns: null }).startsWith(' '));

  // A LEFT-HEAVY bar cannot be centred at any width, because the indent can
  // only ever push right. It falls back rather than cropping its own left.
  const leftHeavy = buildSegments(input({
    model: 'Opus 5 (1M context) high think 200k+',
    project: 'test_mycontext_plugin',
    branch: 'campaign/my-context-test',
    myctx: null, costUsd: null, warmPercent: null,
  }), NOW);
  assert.equal(centreOffset(leftHeavy, 200), 0, 'nothing to the right to balance against');

  // And a bar with no anchor at all — a shape `buildSegments` never makes, so
  // it is constructed by hand — is left alone rather than centred on a guess.
  assert.equal(centreOffset([{ text: 'x', ink: PALETTE['ok'] ?? { bg: 0, fg: 0 } }], 200), 0);
});

/* -------------------------------------------------------------------- *
 * Two lines: identity above, everything that moves below.               *
 * -------------------------------------------------------------------- */

/**
 * **CLAUDE CODE PREPENDS LINE 1'S ESCAPES TO LINE 2**, transcribed verbatim
 * from the installed binary so this suite tests against what the product
 * actually does rather than against what the docs say.
 *
 * Read 2026-08-31 from `claude` 2.1.248, byte offset 203009756:
 *
 * ```js
 * var dYe = /\x1b\[[\d;]*m|\x1b\]8;[^\x07\x1b]*(?:\x07|\x1b\\)/g;
 * function vfe(d) {
 *   let C = d.split("\n");
 *   if (C.length === 1) return C;
 *   let x = [C[0]], H = "";
 *   for (let X = 1; X < C.length; X++) {
 *     H += (C[X - 1].match(dYe) ?? []).join("");
 *     x.push(H + C[X]);
 *   }
 *   return x;
 * }
 * ```
 *
 * EXTERNAL BEHAVIOUR: nothing here fails when Claude Code changes it. What it
 * pins is OUR side of the contract — that our line 2 survives having 157
 * characters of line 1's colour glued in front of it.
 */
const CC_ANSI = /\x1b\[[\d;]*m|\x1b\]8;[^\x07\x1b]*(?:\x07|\x1b\\)/g;
function claudeCodeSplit(out: string): string[] {
  const parts = out.split('\n');
  if (parts.length === 1) return parts;
  const rendered = [parts[0] ?? ''];
  let carried = '';
  for (let i = 1; i < parts.length; i++) {
    carried += (parts[i - 1]?.match(CC_ANSI) ?? []).join('');
    rendered.push(carried + (parts[i] ?? ''));
  }
  return rendered;
}

test('the bar is three lines: identity, this window, then the account', () => {
  // ── THREE SINCE 2026-09-01, and the third row was MEASURED into existence ──
  // The used-of-maximum ruling adds an icon, a ten-cell bar, a percentage and
  // a count pair to five fields. One row carrying all five came to 215 columns
  // against a terminal of about 200, so the measurement went back with options
  // and the owner chose the row over the cut: nothing truncated, no field
  // dropped, no count invented to make the arithmetic work.
  const { identity, window, account } = buildLines(input({
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
    costUsd: 0.42,
    elapsedMs: null,
    sevenDay: { usedPercent: 49, resetsAt: null },
    fiveHour: { usedPercent: 12, resetsAt: null },
  }), NOW);

  // Line 1 is identity and NOTHING on it moves during a session.
  assert.deepEqual(identity.map((seg) => `${seg.label} ${seg.text}`),
    ['MODEL Opus 5', 'REPO test_mycontext_plugin', 'BRANCH campaign/my-context-test']);
  // Line 2 is THIS WINDOW: the ask and the context figure, alone together,
  // which is the comparison the owner actually performs.
  assert.deepEqual(window.map((seg) => `${seg.label} ${seg.text}`), [
    'ASK ▰▰▰▰▱▱▱▱▱▱ 43% (42.0 / 98) ·+56.0',
    'WINDOW ▰▰▰▰▱▱▱▱▱▱ 42.0% (420.0k / 1.0M)',
  ]);
  // Line 3 is the ACCOUNT and the ledger: the two rate windows, the myctx
  // share — banded since the owner's ruling — and the cost.
  assert.deepEqual(account.map((seg) => `${seg.label} ${seg.text}`), [
    '7D ▰▰▰▰▰▱▱▱▱▱ 49%',
    '5H ▰▱▱▱▱▱▱▱▱▱ 12%',
    'MYCTX ≈ ▱▱▱▱▱▱▱▱▱▱ 0.6% (6.2k / 1.0M)',
    'COST $0.42',
    // Last of all, and on the row that moves, because it IS a clock — the same
    // placement the audit clock has and for the same reason.
    `CLOCK ${stamp(NOW)}`,
  ]);
  // The anchor is on the WINDOW row, and neither other row has one — there is
  // nothing on them to centre a bar on.
  assert.equal(identity.filter((seg) => seg.anchor === true).length, 0);
  assert.equal(account.filter((seg) => seg.anchor === true).length, 0);
  assert.equal(window.filter((seg) => seg.anchor === true).length, 1);
});

test('the one-line fallback contains exactly the three rows, concatenated', () => {
  // The honest degradation: a build or a terminal that mishandles a second
  // line gets ONE line carrying everything, never a second line silently lost.
  // Derived by construction, and asserted so it stays derived.
  for (const over of [
    {},
    { myctx: { tokens: 6200, injections: 3, unrecorded: 1 }, teeNote: 'tee not written (disk full)' },
    { model: null, project: null, branch: null, threshold: null },
    { occupancy: { state: 'unmeasurable' as const, why: 'no-bridge' as const } },
  ]) {
    const { identity, window, account } = buildLines(input(over), NOW);
    assert.deepEqual(
      buildSegments(input(over), NOW).map((s2) => s2.text),
      [...identity, ...window, ...account].map((s2) => s2.text),
      'the fallback is the three rows concatenated, so no block can exist in one and not the other',
    );
  }
});

test('each line is rendered whole, within the terminal, and is never wrapped', () => {
  const { identity, window, account } = buildLines(input({
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 }, costUsd: 0.42,
    sevenDay: { usedPercent: 49, resetsAt: null }, fiveHour: { usedPercent: 12, resetsAt: null },
  }), NOW);

  for (let columns = 200; columns >= 12; columns--) {
    const out = renderStatusLine([identity, window, account], { colour: false, columns });
    const rows = out.split('\n');
    assert.equal(rows.length, 3, `expected three rows at ${columns} columns`);
    for (const row of rows) {
      assert.ok(
        displayWidth(row) <= columns,
        `at ${columns} columns a row is ${displayWidth(row)} wide: "${row}"`,
      );
    }
    // The context figure is on the WINDOW row, which is row 2 of three.
    assert.match(rows[1] ?? '', /WINDOW /, `the context figure left its row at ${columns} columns`);
  }
});

test('an empty line is dropped rather than drawn as a bare pair of caps', () => {
  // A session with no model, no project and no branch has no identity line at
  // all. What it must not have is a row containing two caps and nothing else.
  const { identity, account: state } = buildLines(input({ model: null, project: null, branch: null }), NOW);
  assert.equal(identity.length, 0);
  const out = renderStatusLine([identity, state], { colour: false, columns: 200 });
  assert.equal(out.split('\n').length, 1, 'one line, because there was only one line to draw');
  assert.ok(!out.startsWith(FIELD_JOIN), 'no row opens on a bare separator');
  assert.ok(!out.includes(`\n${FIELD_JOIN}`), 'and none opens on one after a newline');
});

/**
 * **THE LEADING RESET IS LOAD-BEARING, and this is the test that says so.**
 *
 * Claude Code glues every escape from line 1 onto the front of line 2 — 157
 * characters of it for an ordinary bar. The only thing that stops line 2 being
 * painted in line 1's final colour is that our own line 2 OPENS with a reset,
 * so the last escape to take effect before any visible cell is that reset.
 *
 * Measured at 91%, where the context block is `crit` and its background is
 * red: without the leading reset the whole of line 2 would render on red.
 */
test('line 2 opens with a reset, so Claude Code’s carried escapes cannot paint it', () => {
  const { identity, window, account } = buildLines(input({
    occupancy: {
      state: 'known', percent: 91, ageMs: 0, usedTokens: 910_000, windowSize: 1_000_000,
    },
    // A block on the account row, so all THREE rows exist and the carried-
    // escape behaviour is exercised across both seams rather than one.
    sevenDay: { usedPercent: 49, resetsAt: null },
  }), NOW);
  const out = renderStatusLine([identity, window, account], { colour: true, columns: 200 });

  const rows = claudeCodeSplit(out);
  assert.equal(rows.length, 3);

  // Everything Claude Code prepended, and then our own line.
  const carried = ((out.split('\n')[0] ?? '').match(CC_ANSI) ?? []).join('');
  assert.ok(carried.length > 0, 'line 1 does carry escapes worth neutralising');
  const ours = (rows[1] ?? '').slice(carried.length);
  assert.ok(
    ours.startsWith('\u001b[0m'),
    'line 2 must reset before it draws anything, or it inherits line 1’s colour',
  );

  // And line 1 closes with a reset too, so nothing escapes the bar at all.
  assert.ok((rows[0] ?? '').endsWith('\u001b[0m'));

  // With colour off there is nothing to carry and nothing to reset.
  const plain = renderStatusLine([identity, window, account], { colour: false, columns: 200 });
  assert.ok(!plain.includes('\u001b'), 'never a raw escape into a pipe that said no');
  assert.equal(plain.split('\n').length, 3);
});

/* -------------------------------------------------------------------- *
 * Line 1's mycontext signals, and line 2's audit clock.                 *
 * -------------------------------------------------------------------- */

test('the session name is drawn only when it tells you something the project does not', () => {
  const named = (sessionName: string | null, project: string | null): string[] =>
    buildLines(input({ sessionName, project }), NOW).identity.map((seg) => seg.text);

  assert.ok(named('my-context V2.0.0 Development', 'test_mycontext_plugin')
    .includes('my-context V2.0.0 Development'), 'a distinct name is what tells two windows apart');
  // Identical to the project: silent, because it restates a block already on
  // the line and the columns are better spent on anything else.
  assert.ok(!named('test_mycontext_plugin', 'test_mycontext_plugin')
    .includes('test_mycontext_plugin ')); // the project block itself still stands
  assert.equal(named('test_mycontext_plugin', 'test_mycontext_plugin').length,
    named(null, 'test_mycontext_plugin').length, 'no extra block for a name that repeats');
  // Case and surrounding space are not a difference.
  assert.equal(named('  Test_MyContext_Plugin  ', 'test_mycontext_plugin').length,
    named(null, 'test_mycontext_plugin').length);
  // And an empty name is not a name.
  assert.equal(named('   ', 'p').length, named(null, 'p').length);
});

test('the focus says what the session is FOR, and is capped so it cannot evict a ranked field', () => {
  const withFocus = (focus: string | null): string[] =>
    buildLines(input({ focus }), NOW).identity.map((seg) => seg.text);

  assert.ok(withFocus('tags: plan:walk').includes('tags: plan:walk'));
  assert.equal(
    buildLines(input({ focus: null }), NOW).identity.filter((s2) => s2.field === 'focus').length,
    0,
  );
  assert.equal(withFocus('   ').filter((t) => t.startsWith('focus')).length, 0);

  // Capped, and marked where it was cut. Truncated from the RIGHT — the
  // opposite of the branch, because a focus reads as a phrase whose head
  // identifies it while a branch's tail is what distinguishes it.
  const long = 'tags: plan:walk seq:123 and a great deal more text than fits';
  const drawn = buildLines(input({ focus: long }), NOW).identity
    .find((s2) => s2.field === 'focus')?.text ?? '';
  assert.ok(drawn.endsWith('…'), 'a cut focus says it was cut');
  assert.equal(displayWidth(drawn), FOCUS_MAX);
  assert.ok(long.startsWith(drawn.slice(0, -1)), 'the head is what survived');
});

/**
 * **THE AUDIT CLOCK** — owner ruling, 2026-09-01. Is this machine still
 * recording anything at all?
 */
test('the audit clock tells an empty log apart from a read that failed', () => {
  const text = (last: Parameters<typeof lastAuditSegment>[0]): string | undefined =>
    lastAuditSegment(last, NOW)?.text;

  assert.equal(text({ state: 'known', op: 'jit', at: new Date(NOW - 120_000).toISOString() }),
    'jit ·2m');
  // Two different facts, two different sentences. "Nothing has been recorded"
  // is a measurement; "I could not tell" is not, and a bar that rendered them
  // the same would make a broken projection look like a quiet machine.
  assert.equal(text({ state: 'empty' }), '— nothing recorded');
  assert.equal(text({ state: 'unreadable' }), '— unreadable');
  assert.notEqual(text({ state: 'empty' }), text({ state: 'unreadable' }));
  // A failed read is a fault and says so in the ink; an empty log is not.
  assert.equal(lastAuditSegment({ state: 'unreadable' }, NOW)?.ink.fg, PALETTE['warn']?.fg);
  assert.equal(lastAuditSegment({ state: 'empty' }, NOW)?.ink.fg, PALETTE['neutral']?.fg);
  // No corpus at all: no block, the same meaning `myctx: null` carries.
  assert.equal(lastAuditSegment(null, NOW), null);
  // A stamp we wrote and cannot parse is not an age of zero.
  assert.equal(text({ state: 'known', op: 'jit', at: 'not-a-date' }), 'jit — undated');
});

/**
 * **THE AGE IS COMPUTED AT RENDER TIME, AND THIS IS THE TEST THAT SAYS SO.**
 *
 * A duration frozen when the value was fetched is the fossil defect this
 * product has shipped three times — a stale context sample drawn as live, a
 * summary that went stale on a retitle, an injection count that spanned
 * fourteen days. A field whose entire job is to age correctly is the last
 * place to reintroduce it, so the same `LastAudit` is rendered at two
 * different `now`s and the two must differ.
 */
test('the audit age moves with the clock rather than being frozen when it was fetched', () => {
  const at = new Date(NOW).toISOString();
  const last = { state: 'known' as const, op: 'jit', at };

  assert.equal(lastAuditSegment(last, NOW)?.text, 'jit ·now');
  assert.equal(lastAuditSegment(last, NOW + 5 * 60_000)?.text, 'jit ·5m');
  assert.equal(lastAuditSegment(last, NOW + 3 * 3_600_000)?.text, 'jit ·3h');
  assert.equal(lastAuditSegment(last, NOW + 26 * 3_600_000)?.text, 'jit ·1d2h');

  // And through `buildLines`, which is what the renderer actually calls: the
  // SAME input at two times produces two different lines.
  const at2 = (now: number): string =>
    buildLines(input({ lastAudit: last }), now).account.map((seg) => seg.text).join('|');
  assert.notEqual(at2(NOW), at2(NOW + 90 * 60_000));

  // A clock that has not moved is not a negative age.
  assert.equal(since(new Date(NOW + 60_000).toISOString(), NOW), 'now');
});

test('an audit log that has gone quiet is MARKED, against the shared freshness constant', () => {
  const fresh = freshMs();
  assert.ok(fresh !== null, 'the shared module supplies the constant this derives from');
  const at = (ageMs: number): string =>
    new Date(NOW - ageMs).toISOString();

  // Inside the window: `--carry`, the blue every UNLEVELLED VALUE wears since
  // the owner's ruling of 2026-09-01. Nothing is being claimed except the age,
  // and blue is this bar's spelling of "a fact, not a verdict" — `--dim` is
  // reserved for the states that are NOT a level at all.
  assert.equal(
    lastAuditSegment({ state: 'known', op: 'jit', at: at(fresh! - 60_000) }, NOW)?.ink.fg,
    PALETTE['carry']?.fg,
  );
  // Past it: warn. The threshold is NOT spelled here — it is
  // `CONTEXT_SAMPLE_FRESH_MS`, the same constant that decides a context sample
  // is too old to present as current, and it moves this with it.
  assert.equal(
    lastAuditSegment({ state: 'known', op: 'jit', at: at(fresh! + 60_000) }, NOW)?.ink.fg,
    PALETTE['warn']?.fg,
  );
});

test('a block given up for width leaves a mark, and two marks collapse into one', () => {
  const segments: Segment[] = [
    { text: 'Opus 5', ink: PALETTE['model'] ?? { bg: 0, fg: 0 } },
    { text: 'test_mycontext_plugin', ink: PALETTE['project'] ?? { bg: 0, fg: 0 } },
    { text: 'campaign/my-context-test', ink: PALETTE['branch'] ?? { bg: 0, fg: 0 }, elidable: true },
    { text: 'ctx 42.0%', ink: PALETTE['ok'] ?? { bg: 0, fg: 0 }, required: true },
  ];
  const fitted = fitSegments(segments, 30);
  assert.ok(fitted.some((s) => s.text === ELLIPSIS_SEGMENT.text), 'something was dropped and said so');
  assert.equal(
    fitted.filter((s) => s.text === '…').length,
    new Set(fitted.map((s, i) => (s.text === '…' ? i : -1)).filter((i) => i >= 0)).size,
    'the marks are counted',
  );
  // No two adjacent: a row of ellipses reads as broken rather than abbreviated.
  for (let i = 1; i < fitted.length; i++) {
    assert.ok(
      !(fitted[i]?.text === '…' && fitted[i - 1]?.text === '…'),
      `two adjacent marks: ${fitted.map((s) => s.text).join('|')}`,
    );
  }
  // The TERSE floor: the label and the number, which is exactly what this
  // field said before the used-of-maximum ruling. The bar and the counts are
  // the decoration a too-narrow terminal gives up; the FIGURE never is.
  assert.equal(fitted.at(-1)?.text, 'ctx 42.0%');
  // Nothing is fitted when there is no width to fit to.
  assert.deepEqual(fitSegments(segments, null), segments);
});

test('the blocks that have nothing to say are absent, and the ones that do are present', () => {
  assert.equal(
    // `threshold: null` as well: with the handover feature off there is no ask
    // and so no distance to it, which is what makes this the genuinely minimal
    // bar. With a threshold configured the scale is present at every fill by
    // the owner's ruling, and that is asserted on the next line rather than
    // hidden by choosing an input that avoids it.
    line({ model: null, project: null, branch: null, threshold: null }),
    `WINDOW ${usageBar(42)} 42.0% (420.0k / 1.0M)${FIELD_JOIN}CLOCK ${stamp(AT)}`,
    'a session with no model, no project and no branch is one block, not three empty ones',
  );
  assert.equal(
    line({ model: null, project: null, branch: null }),
    `ASK ${usageBar(42 / 98 * 100)} 43% (42.0 / 98) ·+56.0`
      + `${FIELD_JOIN}WINDOW ${usageBar(42)} 42.0% (420.0k / 1.0M)`
      + `${FIELD_JOIN}CLOCK ${stamp(AT)}`,
    'a configured ask always states its distance, even on an otherwise empty bar',
  );
  assert.match(line({ teeNote: 'tee not written (disk full)' }), /tee not written \(disk full\)/);
  assert.match(line({ myctxNote: 'projection sync failed' }), /MYCTX unavailable/);
  // **THE FIFTH USED-OF-MAX FIELD since 2026-09-01.** The share is banded
  // against the window it went into, so it draws a bar and a proportion beside
  // its counts. The qualifier rides the label, never the bar, because it
  // qualifies the NUMERATOR: `≈` — never absent, since 2026-09-04 — says the
  // figure counts each item once and is a bound on residency rather than a
  // measurement of it, and `≥` on top of that says some records also carry
  // no frozen estimate, so the true share is at least this.
  assert.match(line({ myctx: { tokens: 6200, injections: 3, unrecorded: 0 } }),
    /MYCTX ≈ [▱▰]{10} 0\.6% \(6\.2k \/ 1\.0M\)/);
  assert.match(line({ myctx: { tokens: 6200, injections: 3, unrecorded: 2 } }),
    /MYCTX ≥ [▱▰]{10} 0\.6% \(6\.2k \/ 1\.0M\)/);
  // **SUPERSEDED CLAIM, restated to the ruling that replaced it.** This used
  // to assert "the context block is LAST whatever else is disclosed". Since
  // the owner centred it on 2026-08-31 it is the ANCHOR, with the disclosures
  // drawn to its right — so what is pinned now is that the anchor exists, that
  // there is exactly one, and that the two groups fall either side of it. The
  // claim moved from a position to a role; it did not weaken.
  const busy = buildSegments(input({
    myctx: { tokens: 6200, injections: 3, unrecorded: 1 },
    teeNote: 'tee not written (disk full)',
  }));
  const anchorAt = busy.findIndex((seg) => seg.anchor === true);
  assert.ok(anchorAt >= 0, 'the bar always has an anchor');
  assert.equal(busy.filter((seg) => seg.anchor === true).length, 1, 'and only one');
  assert.equal(busy[anchorAt]?.field, 'context', 'the anchor IS the context block');
  assert.equal(busy[anchorAt]?.label, 'WINDOW');
  assert.ok(anchorAt > 0, 'the identity blocks are to its left');
  assert.ok(anchorAt < busy.length - 1, 'the disclosures are to its right');
  // The ask rides immediately left of it: they are one question asked twice,
  // and the three-row ruling of 2026-09-01 put them alone on a row together.
  assert.equal(busy[anchorAt - 1]?.field, 'ask');
});

/* -------------------------------------------------------------------- *
 * The branch, read rather than shelled out for.                         *
 * -------------------------------------------------------------------- */

test('gitBranch reads .git/HEAD, follows a worktree pointer, and refuses everything else', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-pl-git-'));
  try {
    // A plain repository, found by walking up from a nested directory.
    const repo = path.join(root, 'repo');
    mkdirSync(path.join(repo, '.git'), { recursive: true });
    mkdirSync(path.join(repo, 'src', 'deep'), { recursive: true });
    writeFileSync(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/campaign/my-context-test\n');
    assert.equal(gitBranch(repo), 'campaign/my-context-test');
    assert.equal(gitBranch(path.join(repo, 'src', 'deep')), 'campaign/my-context-test');

    // A worktree: `.git` is a FILE naming the real git directory.
    const wt = path.join(root, 'worktree');
    mkdirSync(wt, { recursive: true });
    const real = path.join(root, 'realgit');
    mkdirSync(real, { recursive: true });
    writeFileSync(path.join(real, 'HEAD'), 'ref: refs/heads/side-quest\n');
    writeFileSync(path.join(wt, '.git'), `gitdir: ${real}\n`);
    assert.equal(gitBranch(wt), 'side-quest');

    // A detached HEAD is not a branch, and this does not invent a name for it.
    const detached = path.join(root, 'detached');
    mkdirSync(path.join(detached, '.git'), { recursive: true });
    writeFileSync(
      path.join(detached, '.git', 'HEAD'), '9bf8e952e4a2d1c0b7f6a5948372615049382716\n',
    );
    assert.equal(gitBranch(detached), null);

    // No repository anywhere above, and no argument at all.
    assert.equal(gitBranch(null), null);
  } finally {
    removeTree(root);
  }
});

test('the separator is the real powerline glyph and the caps are not private-use', () => {
  // **THE FRAME IS ONE ORDINARY GLYPH SINCE 2026-09-01.** It was two
  // private-use Nerd Font characters and two half-blocks; the owner's
  // reference has none of them, and U+2502 is plain box-drawing that any font
  // with a table in it can draw. A terminal without a Nerd Font now loses
  // nothing at all, where before it lost every separator on the bar.
  assert.equal(FIELD_SEP, '│');
  assert.equal(FIELD_SEP.codePointAt(0), 0x2502, 'U+2502, not the ASCII pipe');
  assert.equal(FIELD_JOIN, ' │ ', 'spaced, which is how it is actually joined');
  assert.equal(displayWidth(FIELD_JOIN), 3, 'and three columns, which is what widthOf counts');
  // Widths are counted in code points, so an astral character is one column and
  // a line that already fitted is not elided for arithmetic reasons.
  assert.equal(displayWidth('abc'), 3);
  assert.equal(displayWidth(FIELD_SEP), 1);
  // **CORRECTED 2026-09-01, and it is a correction rather than a relaxation.**
  // This line asserted 1 for an emoji, which pinned the undercount §8 measured:
  // a pictograph renders in TWO cells, and counting it as one is what makes
  // `fitSegments` fail to give up a block and let the line WRAP. The rule it
  // was really protecting — that a NON-emoji astral character stays one column
  // — is asserted directly below, where it belongs.
  assert.equal(displayWidth('🙂'), 2, 'a pictograph is two cells');
  assert.equal(displayWidth('𝐀'), 1, 'a non-emoji astral character is still one');
});

/* -------------------------------------------------------------------- *
 * The four field groups the owner added after approving the layout.     *
 * -------------------------------------------------------------------- */

/** A payload shaped as build 2.1.239 sends it, with every optional group present. */
/**
 * The four-level boundaries, READ from the shared module rather than typed
 * here. They moved into `lib/viewmodel.js` in phase 2 (2026-09-01); a literal
 * in a test is the same defect as a literal in the renderer, one step further
 * from where anyone would look for it.
 */
const BANDS = usageBands()!;
assert.ok(BANDS !== null, 'the shared band module did not load');

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);
function fullPayload(): Record<string, unknown> {
  return {
    session_id: 's',
    model: { id: 'claude-opus-5', display_name: 'Opus 5' },
    effort: { level: 'high' },
    thinking: { enabled: true },
    fast_mode: false,
    exceeds_200k_tokens: false,
    cost: { total_cost_usd: 0.42, total_duration_ms: 1000 },
    rate_limits: {
      five_hour: { used_percentage: 12, resets_at: NOW / 1000 + 3 * 3600 + 12 * 60 },
      seven_day: { used_percentage: 49, resets_at: NOW / 1000 + 28 * 3600 },
    },
    context_window: {
      context_window_size: 200000,
      current_usage: {
        input_tokens: 300, cache_creation_input_tokens: 100,
        cache_read_input_tokens: 44000, output_tokens: 900,
      },
    },
  };
}

test('the payload reader takes what is there and invents nothing for what is not', () => {
  const extras = payloadExtras(fullPayload());
  assert.deepEqual(extras.modes, {
    effort: 'high', thinking: true, fastMode: false, exceeds200k: false,
  });
  assert.deepEqual(extras.fiveHour, { usedPercent: 12, resetsAt: NOW / 1000 + 3 * 3600 + 12 * 60 });
  assert.deepEqual(extras.sevenDay, { usedPercent: 49, resetsAt: NOW / 1000 + 28 * 3600 });
  assert.equal(extras.costUsd, 0.42);

  // THE CACHE RATIO IS DERIVED, and from the same three counts the occupancy
  // is: `cache_read` over `input + cache_creation + cache_read`. It is not a
  // payload field and must never be read as one.
  assert.ok(extras.warmPercent !== null);
  assert.equal(extras.warmPercent.toFixed(1), '99.1');
  assert.equal(extras.warmPercent, (44000 / (44000 + 100 + 300)) * 100);

  // An empty payload, a null payload, a payload of the wrong shape entirely:
  // every field absent, nothing thrown, and no zero standing in for a number
  // nobody sent.
  for (const junk of [null, undefined, {}, 42, 'a string', []]) {
    const none = payloadExtras(junk);
    assert.deepEqual(none.modes, {
      effort: null, thinking: null, fastMode: null, exceeds200k: null,
    });
    assert.equal(none.fiveHour, null);
    assert.equal(none.sevenDay, null);
    assert.equal(none.costUsd, null);
    assert.equal(none.warmPercent, null, 'no tokens is not 0% warm — it is nothing to divide');
  }

  // Wrong types are absences, not coercions. A string percentage would render
  // as `NaN%` if it were merely trusted.
  const wrong = payloadExtras({
    rate_limits: { five_hour: { used_percentage: '12', resets_at: null } },
    cost: { total_cost_usd: 'free' },
    thinking: { enabled: 'yes' },
  });
  assert.equal(wrong.fiveHour, null);
  assert.equal(wrong.costUsd, null);
  assert.equal(wrong.modes.thinking, null);
});

test('a rate-limit window is banded by the SAME function the context fill is', () => {
  // The ABSOLUTE bands, not the handover-derived ones. A rate-limit window is
  // a quota's own fullness and has nothing to do with when a handover is due;
  // colouring it by the context threshold was the first spelling here and it
  // meant a 7-day window went amber at a boundary set for a context window.
  const ink = (pct: number): number | undefined =>
    rateLimitSegment({ usedPercent: pct, resetsAt: null }, NOW, GIVE.sevenDay, 'rate-7d')?.ink.fg;

  // FOUR bands since 2026-09-01, and the point of the assertion is unchanged:
  // the rate windows are banded by the SAME function the context figure is, so
  // there is exactly one place in this product where a used-of-max percentage
  // becomes a colour.
  assert.equal(ink(BANDS.caution - 0.1), PALETTE['ok']?.fg);
  assert.equal(ink(BANDS.caution), PALETTE['gold']?.fg);
  assert.equal(ink(BANDS.warning), PALETTE['warn']?.fg);
  assert.equal(ink(BANDS.critical), PALETTE['crit']?.fg);
  assert.equal(ink(BANDS.caution), contextSegment({
    state: 'known', percent: BANDS.caution, ageMs: 0,
    usedTokens: 600_000, windowSize: 1_000_000,
  }).ink.fg, 'one function, one colour, two fields');

  // The full treatment, for the same reason the context figure gets it: the
  // owner ruled that every used-of-maximum field takes the SAME controls. A
  // bar and a percentage at 49%, and no icon, because 49% is `safe` and a calm
  // bar is quiet.
  assert.equal(
    rateLimitSegment({ usedPercent: 49, resetsAt: null }, NOW, 0, 'rate-7d')?.text,
    '▰▰▰▰▰▱▱▱▱▱ 49%',
  );
  // And the icon arrives with the band, on the same field.
  assert.equal(
    rateLimitSegment({ usedPercent: 88, resetsAt: null }, NOW, 0, 'rate-7d')?.text,
    `${LEVEL_ICON.critical} ${usageBar(88)} 88%`,
  );
  // A window with no percentage is not a block. A countdown to nothing in
  // particular is not worth a column.
  assert.equal(rateLimitSegment({ usedPercent: null, resetsAt: 1 }, NOW, 0, 'rate-7d'), null);
  assert.equal(rateLimitSegment(null, NOW, 0, 'rate-7d'), null);
});

test('the countdown is two units wide, and it never counts upwards', () => {
  const at = (seconds: number): string | null => until(NOW / 1000 + seconds, NOW);
  assert.equal(at(28 * 3600), '1d4h');
  assert.equal(at(24 * 3600), '1d');
  assert.equal(at(3 * 3600 + 12 * 60), '3h12m');
  assert.equal(at(3 * 3600), '3h');
  assert.equal(at(47 * 60), '47m');
  assert.equal(at(30), 'now');
  // Already past: nothing, rather than a duration with a sign on it.
  assert.equal(at(-60), null);
  assert.equal(until(null, NOW), null);
  assert.equal(until(Number.NaN, NOW), null);
});

test('the model block carries only the modes that are NOT the ordinary case', () => {
  const text = (modes: Partial<ModelModes>): string | null => modelSegment('Opus 5', {
    effort: null, thinking: null, fastMode: null, exceeds200k: null, ...modes,
  })?.text ?? null;

  assert.equal(text({}), 'Opus 5', 'an ordinary session pays zero columns for this group');
  assert.equal(text({ effort: DEFAULT_EFFORT }), 'Opus 5', 'the default effort is not news');
  assert.equal(text({ thinking: false, fastMode: false, exceeds200k: false }), 'Opus 5');
  assert.equal(text({ effort: 'high' }), 'Opus 5 high');
  assert.equal(text({ thinking: true }), 'Opus 5 think');
  assert.equal(text({ fastMode: true }), 'Opus 5 fast');
  assert.equal(text({ exceeds200k: true }), 'Opus 5 200k+');
  assert.equal(
    text({ effort: 'high', thinking: true, fastMode: true, exceeds200k: true }),
    'Opus 5 high think fast 200k+',
  );
  // Words rather than glyphs alone: a bare mark carries meaning only to a
  // reader who already knows it, which is the same failure as colour-only.
  assert.doesNotMatch(
    text({ thinking: true }) ?? '',
    /[\u2190-\u2bff\ue000-\uf8ff]/,
    'a symbol on its own is a hue wearing a different hat',
  );
  // No model name and no modes is no block at all.
  assert.equal(modelSegment(null, {
    effort: null, thinking: null, fastMode: null, exceeds200k: null,
  }), null);
  assert.equal(modelSegment(null, {
    effort: 'high', thinking: null, fastMode: null, exceeds200k: null,
  })?.text, 'high');
});


test('cost and cache are one block, and absent halves cost nothing', () => {
  const of = (over: Partial<PowerlineInput>): string | undefined =>
    buildSegments(input(over), NOW).find((s) => s.give === GIVE.costCache)?.text;
  assert.equal(of({ costUsd: 0.42, warmPercent: 99.09 }), '$0.42 · warm 99.1%');
  assert.equal(of({ costUsd: 0.42, warmPercent: null }), '$0.42');
  assert.equal(of({ costUsd: null, warmPercent: 99.09 }), 'warm 99.1%');
  assert.equal(of({ costUsd: null, warmPercent: null }), undefined, 'no block at all');
});

test('the whole bar, from a real payload shape, with every group present', () => {
  const extras = payloadExtras(fullPayload());
  const rendered = renderPowerline(buildSegments({
    ...extras,
    model: 'Opus 5',
    project: 'test_mycontext_plugin',
    branch: 'campaign/my-context-test',
    occupancy: { state: 'known', percent: 42, ageMs: 0, usedTokens: Math.round((42) * 10_000), windowSize: 1_000_000 },
    threshold: THRESHOLD,
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
    focus: null,
    lastAudit: null,
    myctxNote: null,
    teeNote: null, corpus: null,
  }, NOW), { colour: false, columns: null });

  // **The ONE-LINE FALLBACK, whole.** Since the owner's three-row ruling of
  // 2026-09-01 this is `buildLines` concatenated — identity, then the window
  // pair, then the account — and it is what a Claude Code build or a terminal
  // that mishandles extra lines receives. Asserting it whole is what keeps the
  // fallback a real rendering rather than a code path nobody has looked at.
  //
  // Every used-of-max field here is `safe`, so they share a ground and the
  // separators between them are THIN — the existing rule, reached by a new
  // route now that five fields can be one colour at once.
  assert.equal(rendered, [
    'MODEL Opus 5 high think', 'REPO test_mycontext_plugin',
    'BRANCH campaign/my-context-test',
    'ASK ▰▰▰▰▱▱▱▱▱▱ 43% (42.0 / 98) ·+56.0',
    'WINDOW ▰▰▰▰▱▱▱▱▱▱ 42.0% (420.0k / 1.0M)',
    '7D ▰▰▰▰▰▱▱▱▱▱ 49% ·1d4h',
    '5H ▰▱▱▱▱▱▱▱▱▱ 12% ·3h12m',
    'MYCTX ≈ ▱▱▱▱▱▱▱▱▱▱ 0.6% (6.2k / 1.0M)',
    'COST $0.42 · warm 99.1%',
    // The elapsed clock the owner's reference closes on. `total_duration_ms`
    // is 1000 in this payload, which is under a minute and therefore `now`.
    'ELAPSED now',
    // And the wall clock, which is the field that says how stale all of the
    // above is on a surface that cannot repaint itself.
    `CLOCK ${stamp(NOW)}`,
    // NO `CWD` AND NO `CORPUS`, and that is the assertion rather than an
    // omission: this payload carries no `cwd`, so there is no directory to
    // draw and no corpus resolved from one. A bar that invented `.` there
    // would be claiming the session had not moved from a directory nobody
    // named. Their present states are reached by `test/ui/strip-parity.test.ts`
    // and by the fixtures in `test/cli/statusline.test.ts`.
  ].join(FIELD_JOIN));
});

test('the separator is one dim rule, the same between every pair of fields', () => {
  // ── SUPERSEDED, AND THE REASON IT EXISTED IS WORTH KEEPING ──────────────
  // This test used to assert that two blocks sharing a BACKGROUND were parted
  // by a thin chevron, because a solid arrow painted in the colour it sat on
  // vanished — three green blocks in a row rendered as one long green block.
  // Dropping the powerline frame dissolves that problem rather than solving
  // it: with the ink on the TEXT there is no ground for a separator to
  // disappear into, so one glyph in one colour works at every combination of
  // bands, and the second separator is gone along with the first.
  const green = PALETTE['ok'];
  const grey = PALETTE['project'];
  assert.ok(green !== undefined && grey !== undefined);

  const same = renderPowerline(
    [{ text: 'a', ink: green!, give: 1 }, { text: 'b', ink: green!, required: true }],
    { colour: true, columns: null },
  );
  const differ = renderPowerline(
    [{ text: 'a', ink: grey!, give: 1 }, { text: 'b', ink: green!, required: true }],
    { colour: true, columns: null },
  );
  // ONE separator glyph, whatever the neighbours are wearing.
  for (const out of [same, differ]) {
    assert.equal((out.match(new RegExp(FIELD_SEP, 'g')) ?? []).length, 1);
  }
  // Painted in the NEUTRAL ink and in neither neighbour's: a rule between two
  // columns belongs to the table, not to a column.
  const dim = PALETTE['neutral'];
  assert.ok(dim !== undefined);
  for (const out of [same, differ]) {
    assert.ok(out.includes(`[38;5;${dim!.fg}m${FIELD_JOIN}`),
      'the separator is not painted in the neutral ink');
  }
  // And NOTHING sets a background any more — the frame is gone, not hidden.
  for (const out of [same, differ]) {
    assert.ok(!out.includes('48;5;'), 'a background fill survived the restyle');
  }
});

test('the line gives itself up in the order the owner ranked, not by width', () => {
  const extras = payloadExtras(fullPayload());
  const full: PowerlineInput = {
    ...extras,
    model: 'Opus 5',
    project: 'test_mycontext_plugin',
    branch: 'campaign/my-context-test',
    occupancy: { state: 'known', percent: 42, ageMs: 0, usedTokens: Math.round((42) * 10_000), windowSize: 1_000_000 },
    threshold: THRESHOLD,
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
    focus: null,
    lastAudit: null,
    myctxNote: null,
    teeNote: null, corpus: null,
  };
  // Compared as RENDERED fields — name and value — since the owner's labels
  // ruling moved the name out of the value and into its own property.
  const at = (columns: number): string[] =>
    fitSegments(buildSegments(full, NOW), columns)
      .map((s) => (s.label === undefined ? s.text : `${s.label} ${s.text}`));

  // Widest-first would give up `test_mycontext_plugin` and then the rate-limit
  // windows long before the model name. Rank-first gives up cost and cache
  // first, and keeps both windows until nothing but the context figure is left.
  //
  // **The WIDTHS moved and the RANKING did not.** The used-of-maximum ruling
  // grew five blocks by twenty-odd cells each, and the owner's headroom ruling
  // added seven more to the ask, so every rung of this ladder is reached at a
  // wider terminal than it used to be. `GIVE` has not been touched by either
  // change, which is what this test is actually about — the ORDER the bar
  // gives itself up in, never the widths at which it does.
  const D7 = '7D ▰▰▰▰▰▱▱▱▱▱ 49% ·1d4h';
  const H5 = '5H ▰▱▱▱▱▱▱▱▱▱ 12% ·3h12m';
  const MY = 'MYCTX ≈ ▱▱▱▱▱▱▱▱▱▱ 0.6% (6.2k / 1.0M)';
  assert.ok(!at(195).includes('COST $0.42 · warm 99.1%'), 'cost and cache go first');
  assert.ok(at(195).includes(D7));
  assert.ok(!at(170).includes(MY), 'the share goes before the windows');
  assert.ok(at(170).includes(H5));
  assert.ok(!at(180).includes('REPO test_mycontext_plugin'), 'the project goes before the windows');
  // At ONE width, which is the sharpest form the claim has: 170 columns is
  // where the project name has already gone and the model name has not.
  assert.ok(at(170).includes('MODEL Opus 5 high think'), 'the model outlives the project');
  assert.ok(at(120).includes(D7), 'the windows are the last real blocks');
  assert.ok(at(90).includes(H5), 'and the 5-hour window is the very last of them');
  // The context figure is no longer the last BLOCK — it is the anchor, with
  // the windows drawn to its right — so what is pinned is that it is still
  // there, which is the claim that mattered.
  // Below the width of the drawn block the context figure falls back to its
  // TERSE spelling — the label and the number, which is exactly what it said
  // before the used-of-maximum ruling. The bar and the counts are decoration;
  // the FIGURE is never shortened.
  assert.ok(at(45).some((t) => t.startsWith('WINDOW ')));
  assert.deepEqual(
    at(16), ['WINDOW 42.0%'],
    'the context figure is the one thing never given up',
  );
  // Below the width of its own block it gives up the GLYPH and keeps the
  // number: the colour still carries the level, and the figure itself is never
  // shortened. This is the floor.
  // The NAME survives the terse fallback wherever it FITS — `WINDOW 42.0%` is
  // 12 cells and 12 columns is where it still does. Below that the name is
  // the last thing given up, because a wrapped row is the one failure this
  // renderer must not have; the FIGURE is never shortened at any width.
  assert.deepEqual(at(12), ['WINDOW 42.0%']);
  assert.deepEqual(at(11), ['42.0%'], 'below its own width the name goes, never the figure');

  // And every width in between still fits and still carries it.
  // 9 cells is the bare figure itself, which is never shortened.
  for (let w = 170; w >= 9; w--) {
    const rendered = renderPowerline(fitSegments(buildSegments(full, NOW), w), {
      colour: false, columns: w,
    });
    assert.ok(displayWidth(rendered) <= w, `${w} columns, ${displayWidth(rendered)} wide`);
    // The NAME is given up only below the width at which it fits — the last
    // thing to go, and only to stop the row wrapping. The FIGURE never is.
    assert.match(rendered, /42\.0%/);
  }
});

/* ══ §8 — THE WIDTH ARITHMETIC, FIXED AND TESTED BEFORE THE ICONS ═══════════
 *
 * `displayWidth` counted code points until 2026-09-01, and its own note said
 * that was deliberate because nothing on the bar was ever wider than one cell.
 * The four-level treatment puts emoji on the bar and breaks that premise. The
 * measured error was up to five cells on one row, landing in `fitSegments` and
 * `centreOffset` — a line that gives up the wrong block, or gives up none and
 * WRAPS, which this file names as the one failure this renderer must not have.
 *
 * These tests were written and run BEFORE the first icon reached a segment,
 * which is the whole reason they are worth having: they pin the arithmetic
 * rather than the appearance, so they would have failed on the old function.
 */
test('an emoji occupies TWO display cells, not one', () => {
  // The three the levels actually use, and the two ranges that cover them.
  assert.equal(displayWidth('\u{1F480}'), 2, '💀 U+1F480 renders two cells');
  assert.equal(displayWidth('\u{1F536}'), 2, '🔶 U+1F536 renders two cells');
  assert.equal(displayWidth('⚠️'), 2, '⚠️ is two cells, not three');
  // U+FE0F is a MODIFIER on the character before it, so it is zero cells of
  // its own. Counting it as one is what made `⚠️` come out right for the wrong
  // reason, and right-by-luck stops being right on a different icon.
  assert.equal(displayWidth('️'), 0, 'the variation selector is zero-width');
  assert.equal(displayWidth('⚠'), 2, 'the bare symbol is already two');
});

test('the emoji rule does not touch anything the bar already drew', () => {
  // Every character this renderer put on the line before the icons existed.
  // A width rule that widened the separator or a box-drawing cell would elide branches
  // that already fitted — the regression the ORIGINAL note was guarding.
  for (const one of [FIELD_SEP, '▰', '▱', '…', '·', '$', 'a', '7']) {
    assert.equal(displayWidth(one), 1, `${JSON.stringify(one)} is one cell`);
  }
  for (const glyph of Object.values(LEVEL_GLYPH)) {
    assert.equal(displayWidth(glyph), 1, `the level glyph ${glyph} stays one cell`);
  }
  assert.equal(displayWidth(ASK_GLYPH), 1, 'the ask marker stays one cell');
  assert.equal(displayWidth('campaign/my-context-test'), 24);
  // An astral character that is NOT an emoji still counts as one, which is the
  // property the original note was written to protect.
  assert.equal(displayWidth('\u{1D400}'), 1, 'a mathematical capital A is not an emoji');
});

test('a mixed string adds up, and the old code-point count would not have', () => {
  const text = '\u{1F480} ctx 54.9%';
  assert.equal(displayWidth(text), 12);
  assert.equal([...text].length, 11, 'the code-point count is the one that was wrong');
});
