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
  ASK_GLYPH, CAP_LEFT, CAP_RIGHT,
  DEFAULT_EFFORT, ELLIPSIS_SEGMENT, GIVE, LEVEL_GLYPH, LEVEL_SOURCE, NO_EXTRAS,
  PALETTE, SEP, SEP_THIN,
  absoluteFillLevel, askSegment, bandsAreDerived, bandsFor, buildSegments, colourAllowed,
  fillBands,
  contextSegment, displayWidth, fitSegments, freshMs, gitBranch, levelFor, modelSegment,
  payloadExtras, rateLimitSegment, renderPowerline, separatorFor, until, centreOffset,
  buildLines, renderStatusLine, FOCUS_MAX, lastAuditSegment, since,
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
    occupancy: { state: 'known', percent: 42, ageMs: 0 },
    threshold: THRESHOLD,
    myctx: null,
    focus: null,
    lastAudit: null,
    myctxNote: null,
    teeNote: null,
    ...over,
  };
}

function line(over: Partial<PowerlineInput>, colour = false, columns: number | null = null): string {
  return renderPowerline(buildSegments(input(over)), { colour, columns });
}

/**
 * The context block's ink — the FILL, which is absolute.
 *
 * `threshold` is still a parameter and is still passed by the callers below,
 * and it is deliberately ignored: several tests assert that moving it does
 * not move this, and a signature that could not take it could not say so.
 */
function ctxInk(percent: number, ageMs = 0, _threshold: number | null = THRESHOLD): number {
  return contextSegment({ state: 'known', percent, ageMs }).ink.bg;
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
      ctxInk(70, 0, threshold), PALETTE['warn']?.bg,
      '70% is amber whatever the handover threshold is',
    );
    assert.equal(ctxInk(90, 0, threshold), PALETTE['crit']?.bg);
    assert.equal(ctxInk(10, 0, threshold), PALETTE['ok']?.bg);
  }
});

test('the context block changes colour as the window fills, and carries a glyph too', () => {
  const ok = ctxInk(FILL_WARN - 0.1);
  const warn = ctxInk(FILL_WARN);
  const crit = ctxInk(FILL_CRIT);
  const stale = contextSegment({ state: 'unmeasurable', why: 'stale' }).ink.bg;

  assert.equal(new Set([ok, warn, crit, stale]).size, 4, 'four states, four hues');
  assert.equal(ok, PALETTE['ok']?.bg);
  assert.equal(warn, PALETTE['warn']?.bg);
  assert.equal(crit, PALETTE['crit']?.bg);
  assert.equal(stale, PALETTE['neutral']?.bg);

  // A glyph AND a colour AND a name, the web strip's own rule and its own four
  // glyphs. Colour is never the only carrier: --warn and --crit are one state
  // to a dichromat and one grey on a mono terminal.
  const text = (percent: number): string =>
    contextSegment({ state: 'known', percent, ageMs: 0 }).text;
  assert.match(text(10), new RegExp(`^${LEVEL_GLYPH.ok} ctx `));
  assert.match(text(70), new RegExp(`^${LEVEL_GLYPH.warn} ctx `));
  assert.match(text(90), new RegExp(`^${LEVEL_GLYPH.crit} ctx `));
  assert.match(
    contextSegment({ state: 'unmeasurable', why: 'stale' }).text,
    new RegExp(`^${LEVEL_GLYPH.neutral} ctx `),
  );
  assert.equal(new Set(Object.values(LEVEL_GLYPH)).size, 4, 'four glyphs, all different');

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
    occupancy: { state: 'known', percent: 10, ageMs: 0 }, threshold: null,
  }));
  const near = buildSegments(input({
    occupancy: { state: 'known', percent: 70, ageMs: 0 }, threshold: null,
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
    askSegment({ state: 'known', percent, ageMs: 0 }, threshold);

  for (const threshold of [98, 85, 50]) {
    const bands = web.occupancyBands(threshold);
    assert.ok(bands !== null);
    // BELOW the approach it is no longer silent — it states the gap. This is
    // the line the ruling moved, and it is asserted at the exact boundary the
    // old contract went quiet at.
    const below = bands.warn - 0.1;
    assert.equal(
      marker(below, threshold)?.text,
      `${ASK_GLYPH} ask ${threshold} · +${(threshold - below).toFixed(1)}`,
    );
    assert.equal(
      marker(bands.warn, threshold)?.text,
      `${ASK_GLYPH} ask ${threshold} · +${(threshold - bands.warn).toFixed(1)}`,
    );
    assert.equal(marker(bands.crit, threshold)?.text, `${ASK_GLYPH} handover due`);

    // The gap SHRINKS as the window fills, and it is the figure that carries
    // that — a scale whose number did not move would be a decoration.
    assert.equal(marker(threshold - 40, threshold)?.text, `${ASK_GLYPH} ask ${threshold} · +40.0`);
    assert.equal(marker(threshold - 2, threshold)?.text, `${ASK_GLYPH} ask ${threshold} · +2.0`);

    // ONE gold, EARNED. Dim while there is nothing to act on; gold as the ask
    // approaches; gold and bold once it has fired. Words and weight carry the
    // last step, never a second hue — a second gold is the same gold to a mono
    // terminal and to a printer.
    assert.equal(marker(below, threshold)?.ink.bg, PALETTE['neutral']?.bg);
    assert.equal(marker(bands.warn, threshold)?.ink.bg, PALETTE['gold']?.bg);
    assert.equal(marker(bands.crit, threshold)?.ink.bg, PALETTE['gold']?.bg);
    assert.notEqual(marker(below, threshold)?.bold, true);
    assert.notEqual(marker(bands.warn, threshold)?.bold, true);
    assert.equal(marker(bands.crit, threshold)?.bold, true);
    // The marker glyph never leaves, so the block's identity does not move
    // with its urgency.
    for (const pct of [below, bands.warn, bands.crit]) {
      assert.ok(marker(pct, threshold)?.text.startsWith(ASK_GLYPH));
    }
  }

  // THE OWNER'S OWN THREE EXAMPLES, verbatim, at the threshold in force here.
  assert.equal(marker(25.1, 85)?.text, '◆ ask 85 · +59.9');
  assert.equal(marker(81.8, 85)?.text, '◆ ask 85 · +3.2');
  assert.equal(marker(91.0, 85)?.text, '◆ handover due');

  // THE EARLIER RULING'S EXAMPLE, still true and still worth pinning: the ask
  // is a different question from the fill. At 98 the ask is 18 points away
  // while the fill is already amber; at 85 the same 80% is approaching. The
  // fill does not move with the threshold, and now the DISTANCE says so in
  // numbers rather than by falling silent.
  assert.equal(marker(80, 98)?.text, `${ASK_GLYPH} ask 98 · +18.0`);
  assert.equal(marker(80, 98)?.ink.bg, PALETTE['neutral']?.bg, 'not near at 98');
  assert.equal(marker(80, 85)?.ink.bg, PALETTE['gold']?.bg, 'near at 85');
  assert.equal(ctxInk(80, 0, 98), ctxInk(80, 0, 85));

  // A threshold that is not a whole number keeps its decimal, and the gap
  // always carries one.
  assert.equal(marker(80, 92.5)?.text, `${ASK_GLYPH} ask 92.5 · +12.5`);

  // No ask configured, no distance to it. No claim about a window that cannot
  // be measured, and none about a fossil.
  assert.equal(marker(100, null), null);
  assert.equal(askSegment({ state: 'unmeasurable', why: 'no-sample' }, 98), null);
  assert.equal(
    askSegment({ state: 'known', percent: 100, ageMs: web.CONTEXT_SAMPLE_FRESH_MS + 1 }, 98),
    null,
  );

  // And the gold is not one of the fill hues, so the two questions never read
  // as one answer.
  assert.equal(
    new Set([
      PALETTE['gold']?.bg, PALETTE['ok']?.bg, PALETTE['warn']?.bg,
      PALETTE['crit']?.bg, PALETTE['neutral']?.bg,
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
      contextSegment({ state: 'unmeasurable', why }).ink.bg,
      PALETTE['neutral']?.bg,
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
  assert.equal(plain, `${CAP_LEFT} Opus 5 ${SEP} test_mycontext_plugin ${SEP} `
    + `campaign/my-context-test ${SEP} ${ASK_GLYPH} ask 98 · +56.0 `
    + `${SEP} ${LEVEL_GLYPH.ok} ctx 42.0% ${CAP_RIGHT}`);
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
  // 85 columns, not 60: the handover scale the owner added on 2026-08-31 is a
  // permanent ~19-cell block, so the width at which the branch is SHORTENED
  // rather than given up entirely moved up with it. The assertion is the same
  // one — the distinguishing tail is the half worth keeping — measured where
  // eliding is what actually happens. Below this the branch is given up whole
  // and the `…` says so, which the ladder test covers.
  const columns = 85;
  const narrow = line({}, false, columns);
  assert.ok(displayWidth(narrow) <= columns, `${displayWidth(narrow)} > ${columns}`);
  // The distinguishing TAIL survives; the leading `…` says a head was removed.
  assert.match(narrow, /…[^ ]*-test /, 'the distinguishing TAIL is what survived');
  assert.match(narrow, /ctx 42\.0%/);

  // Every width from very wide to very narrow: the line never exceeds the
  // terminal, and the context block never goes. A bar that wraps costs the
  // user a line of their transcript on every assistant message.
  for (let w = 120; w >= 12; w--) {
    const rendered = line({}, false, w);
    assert.ok(
      displayWidth(rendered) <= w,
      `at ${w} columns the line is ${displayWidth(rendered)} wide: "${rendered}"`,
    );
    assert.match(rendered, /ctx 42\.0%/, `the context block was given up at ${w} columns`);
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
    occupancy: { state: 'known', percent: 42, ageMs: 0 },
    threshold: 98,
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
    costUsd: 0.42,
    warmPercent: 99.1,
    sevenDay: { usedPercent: 49, resetsAt: null },
    fiveHour: { usedPercent: 12, resetsAt: null },
  });
}

/** Where the anchor's middle falls, counted the way `widthOf` counts. */
function anchorMidpoint(fitted: Segment[]): number {
  const at = fitted.findIndex((seg) => seg.anchor === true);
  assert.ok(at >= 0, 'the bar has an anchor');
  let start = 1;
  for (let i = 0; i < at; i++) start += displayWidth(fitted[i]?.text ?? '') + 3;
  return start + (displayWidth(fitted[at]?.text ?? '') + 2) / 2;
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
    assert.ok(rendered.startsWith(' '.repeat(offset) + CAP_LEFT), 'the indent is plain spaces');
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
    assert.match(rendered, /ctx 42\.0%/, `the context figure went at ${columns} columns`);
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

test('the bar is two lines: identity above, everything that moves below', () => {
  const { identity, state } = buildLines(input({
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
    costUsd: 0.42,
    sevenDay: { usedPercent: 49, resetsAt: null },
    fiveHour: { usedPercent: 12, resetsAt: null },
  }), NOW);

  // Line 1 is identity and NOTHING on it moves during a session.
  assert.deepEqual(identity.map((seg) => seg.text),
    ['Opus 5', 'test_mycontext_plugin', 'campaign/my-context-test']);
  // Line 2 is the owner's order: the ask and the context figure first and
  // adjacent, then the windows, then the share and the cost.
  assert.deepEqual(state.map((seg) => seg.text), [
    `${ASK_GLYPH} ask 98 · +56.0`,
    `${LEVEL_GLYPH.ok} ctx 42.0%`,
    `${LEVEL_GLYPH.ok} 7d 49%`,
    `${LEVEL_GLYPH.ok} 5h 12%`,
    'myctx 6.2k',
    '$0.42',
  ]);
  // The anchor is on line 2, and line 1 has none — there is nothing on it to
  // centre a bar on, and nothing on it that would justify moving.
  assert.equal(identity.filter((seg) => seg.anchor === true).length, 0);
  assert.equal(state.filter((seg) => seg.anchor === true).length, 1);
});

test('the one-line fallback contains exactly the two lines, concatenated', () => {
  // The honest degradation: a build or a terminal that mishandles a second
  // line gets ONE line carrying everything, never a second line silently lost.
  // Derived by construction, and asserted so it stays derived.
  for (const over of [
    {},
    { myctx: { tokens: 6200, injections: 3, unrecorded: 1 }, teeNote: 'tee not written (disk full)' },
    { model: null, project: null, branch: null, threshold: null },
    { occupancy: { state: 'unmeasurable' as const, why: 'no-bridge' as const } },
  ]) {
    const { identity, state } = buildLines(input(over), NOW);
    assert.deepEqual(
      buildSegments(input(over), NOW).map((s2) => s2.text),
      [...identity, ...state].map((s2) => s2.text),
      'the fallback is the two lines concatenated, so no block can exist in one and not the other',
    );
  }
});

test('each line is rendered whole, within the terminal, and is never wrapped', () => {
  const { identity, state } = buildLines(input({
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 }, costUsd: 0.42,
    sevenDay: { usedPercent: 49, resetsAt: null }, fiveHour: { usedPercent: 12, resetsAt: null },
  }), NOW);

  for (let columns = 200; columns >= 12; columns--) {
    const out = renderStatusLine([identity, state], { colour: false, columns });
    const rows = out.split('\n');
    assert.equal(rows.length, 2, `expected two rows at ${columns} columns`);
    for (const row of rows) {
      assert.ok(
        displayWidth(row) <= columns,
        `at ${columns} columns a row is ${displayWidth(row)} wide: "${row}"`,
      );
    }
    assert.match(rows[1] ?? '', /ctx /, `the context figure left line 2 at ${columns} columns`);
  }
});

test('an empty line is dropped rather than drawn as a bare pair of caps', () => {
  // A session with no model, no project and no branch has no identity line at
  // all. What it must not have is a row containing two caps and nothing else.
  const { identity, state } = buildLines(input({ model: null, project: null, branch: null }), NOW);
  assert.equal(identity.length, 0);
  const out = renderStatusLine([identity, state], { colour: false, columns: 200 });
  assert.equal(out.split('\n').length, 1, 'one line, because there was only one line to draw');
  assert.ok(!out.startsWith(`${CAP_LEFT} ${CAP_RIGHT}`));
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
  const { identity, state } = buildLines(input({
    occupancy: { state: 'known', percent: 91, ageMs: 0 },
  }), NOW);
  const out = renderStatusLine([identity, state], { colour: true, columns: 200 });

  const rows = claudeCodeSplit(out);
  assert.equal(rows.length, 2);

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
  const plain = renderStatusLine([identity, state], { colour: false, columns: 200 });
  assert.ok(!plain.includes('\u001b'), 'never a raw escape into a pipe that said no');
  assert.equal(plain.split('\n').length, 2);
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

  assert.ok(withFocus('tags: plan:walk').includes('focus tags: plan:walk'));
  assert.equal(withFocus(null).filter((t) => t.startsWith('focus')).length, 0);
  assert.equal(withFocus('   ').filter((t) => t.startsWith('focus')).length, 0);

  // Capped, and marked where it was cut. Truncated from the RIGHT — the
  // opposite of the branch, because a focus reads as a phrase whose head
  // identifies it while a branch's tail is what distinguishes it.
  const long = 'tags: plan:walk seq:123 and a great deal more text than fits';
  const drawn = withFocus(long).find((t) => t.startsWith('focus')) ?? '';
  assert.ok(drawn.endsWith('…'), 'a cut focus says it was cut');
  assert.equal(displayWidth(drawn), 'focus '.length + FOCUS_MAX);
  assert.ok(long.startsWith(drawn.slice('focus '.length, -1)), 'the head is what survived');
});

/**
 * **THE AUDIT CLOCK** — owner ruling, 2026-09-01. Is this machine still
 * recording anything at all?
 */
test('the audit clock tells an empty log apart from a read that failed', () => {
  const text = (last: Parameters<typeof lastAuditSegment>[0]): string | undefined =>
    lastAuditSegment(last, NOW)?.text;

  assert.equal(text({ state: 'known', op: 'jit', at: new Date(NOW - 120_000).toISOString() }),
    'log jit ·2m');
  // Two different facts, two different sentences. "Nothing has been recorded"
  // is a measurement; "I could not tell" is not, and a bar that rendered them
  // the same would make a broken projection look like a quiet machine.
  assert.equal(text({ state: 'empty' }), 'log — nothing recorded');
  assert.equal(text({ state: 'unreadable' }), 'log — unreadable');
  assert.notEqual(text({ state: 'empty' }), text({ state: 'unreadable' }));
  // A failed read is a fault and says so in the ink; an empty log is not.
  assert.equal(lastAuditSegment({ state: 'unreadable' }, NOW)?.ink.bg, PALETTE['warn']?.bg);
  assert.equal(lastAuditSegment({ state: 'empty' }, NOW)?.ink.bg, PALETTE['neutral']?.bg);
  // No corpus at all: no block, the same meaning `myctx: null` carries.
  assert.equal(lastAuditSegment(null, NOW), null);
  // A stamp we wrote and cannot parse is not an age of zero.
  assert.equal(text({ state: 'known', op: 'jit', at: 'not-a-date' }), 'log jit — undated');
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

  assert.equal(lastAuditSegment(last, NOW)?.text, 'log jit ·now');
  assert.equal(lastAuditSegment(last, NOW + 5 * 60_000)?.text, 'log jit ·5m');
  assert.equal(lastAuditSegment(last, NOW + 3 * 3_600_000)?.text, 'log jit ·3h');
  assert.equal(lastAuditSegment(last, NOW + 26 * 3_600_000)?.text, 'log jit ·1d2h');

  // And through `buildLines`, which is what the renderer actually calls: the
  // SAME input at two times produces two different lines.
  const at2 = (now: number): string =>
    buildLines(input({ lastAudit: last }), now).state.map((seg) => seg.text).join('|');
  assert.notEqual(at2(NOW), at2(NOW + 90 * 60_000));

  // A clock that has not moved is not a negative age.
  assert.equal(since(new Date(NOW + 60_000).toISOString(), NOW), 'now');
});

test('an audit log that has gone quiet is MARKED, against the shared freshness constant', () => {
  const fresh = freshMs();
  assert.ok(fresh !== null, 'the shared module supplies the constant this derives from');
  const at = (ageMs: number): string =>
    new Date(NOW - ageMs).toISOString();

  // Inside the window: neutral. Nothing is being claimed except the age.
  assert.equal(
    lastAuditSegment({ state: 'known', op: 'jit', at: at(fresh! - 60_000) }, NOW)?.ink.bg,
    PALETTE['neutral']?.bg,
  );
  // Past it: warn. The threshold is NOT spelled here — it is
  // `CONTEXT_SAMPLE_FRESH_MS`, the same constant that decides a context sample
  // is too old to present as current, and it moves this with it.
  assert.equal(
    lastAuditSegment({ state: 'known', op: 'jit', at: at(fresh! + 60_000) }, NOW)?.ink.bg,
    PALETTE['warn']?.bg,
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
    `${CAP_LEFT} ${LEVEL_GLYPH.ok} ctx 42.0% ${CAP_RIGHT}`,
    'a session with no model, no project and no branch is one block, not three empty ones',
  );
  assert.equal(
    line({ model: null, project: null, branch: null }),
    `${CAP_LEFT} ${ASK_GLYPH} ask 98 · +56.0 ${SEP} ${LEVEL_GLYPH.ok} ctx 42.0% ${CAP_RIGHT}`,
    'a configured ask always states its distance, even on an otherwise empty bar',
  );
  assert.match(line({ teeNote: 'tee not written (disk full)' }), /tee not written \(disk full\)/);
  assert.match(line({ myctxNote: 'projection sync failed' }), /myctx unavailable/);
  assert.match(line({ myctx: { tokens: 6200, injections: 3, unrecorded: 0 } }), /myctx 6\.2k/);
  assert.match(line({ myctx: { tokens: 6200, injections: 3, unrecorded: 2 } }), /myctx ≥6\.2k/);
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
  assert.match(busy[anchorAt]?.text ?? '', / ctx /);
  assert.ok(anchorAt > 0, 'the identity blocks are to its left');
  assert.ok(anchorAt < busy.length - 1, 'the disclosures are to its right');
  // The ask rides immediately left of it: they are one question asked twice.
  assert.ok(busy[anchorAt - 1]?.text.startsWith(ASK_GLYPH));
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
  assert.equal(SEP.codePointAt(0), 0xe0b0, 'U+E0B0, not the ASCII stand-in the brief drew');
  assert.equal(SEP.length, 1);
  assert.equal(CAP_LEFT, '▐');
  assert.equal(CAP_RIGHT, '▌');
  // Widths are counted in code points, so an astral character is one column and
  // a line that already fitted is not elided for arithmetic reasons.
  assert.equal(displayWidth('abc'), 3);
  assert.equal(displayWidth(SEP), 1);
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
    rateLimitSegment('7d', { usedPercent: pct, resetsAt: null }, NOW, GIVE.sevenDay, 'rate-7d')?.ink.bg;

  assert.equal(ink(FILL_WARN - 0.1), PALETTE['ok']?.bg);
  assert.equal(ink(FILL_WARN), PALETTE['warn']?.bg);
  assert.equal(ink(FILL_CRIT), PALETTE['crit']?.bg);

  // A glyph too, the same four, for the same reason.
  assert.equal(
    rateLimitSegment('7d', { usedPercent: 49, resetsAt: null }, NOW, 0, 'rate-7d')?.text,
    `${LEVEL_GLYPH.ok} 7d 49%`,
  );
  // A window with no percentage is not a block. A countdown to nothing in
  // particular is not worth a column.
  assert.equal(rateLimitSegment('7d', { usedPercent: null, resetsAt: 1 }, NOW, 0, 'rate-7d'), null);
  assert.equal(rateLimitSegment('7d', null, NOW, 0, 'rate-7d'), null);
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
    occupancy: { state: 'known', percent: 42, ageMs: 0 },
    threshold: THRESHOLD,
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
    focus: null,
    lastAudit: null,
    myctxNote: null,
    teeNote: null,
  }, NOW), { colour: false, columns: null });

  // **The ONE-LINE FALLBACK, whole.** Since the owner's two-line ruling this
  // is `buildLines` concatenated — identity, then state in the owner's line-2
  // order — and it is what a Claude Code build or a terminal that mishandles a
  // second line receives. Asserting it here is what keeps the fallback a real
  // rendering rather than a code path nobody has looked at.
  assert.equal(rendered, [
    `${CAP_LEFT} Opus 5 high think`, 'test_mycontext_plugin', 'campaign/my-context-test',
  ].join(` ${SEP} `)
    + ` ${SEP} ${ASK_GLYPH} ask 98 · +56.0`
    + ` ${SEP} ${LEVEL_GLYPH.ok} ctx 42.0%`
    + ` ${SEP_THIN} ${LEVEL_GLYPH.ok} 7d 49% ·1d4h ${SEP_THIN} ${LEVEL_GLYPH.ok} 5h 12% ·3h12m`
    + ` ${SEP} myctx 6.2k ${SEP_THIN} $0.42 · warm 99.1% ${CAP_RIGHT}`);
});

test('two blocks on the same ground are parted by the THIN separator, never an invisible one', () => {
  // Three "ok" blocks in a row is the ordinary calm day — 7d, 5h and ctx all
  // green — and a solid separator painted in the colour it sits on would draw
  // them as one long block with two invisible arrows inside it.
  const green = PALETTE['ok'];
  const grey = PALETTE['project'];
  assert.ok(green !== undefined && grey !== undefined);
  assert.equal(separatorFor(green, green), SEP_THIN);
  assert.equal(separatorFor(green, grey), SEP);
  assert.equal(SEP_THIN.codePointAt(0), 0xe0b1);
  assert.notEqual(SEP_THIN, SEP);

  // And in colour the thin one is painted on the shared ground rather than
  // across a boundary that is not there.
  const coloured = renderPowerline(
    [
      { text: 'a', ink: green, give: 1 },
      { text: 'b', ink: green, required: true },
    ],
    { colour: true, columns: null },
  );
  assert.ok(
    coloured.includes(`\u001b[38;5;${green.fg}m\u001b[48;5;${green.bg}m${SEP_THIN}`),
    'the thin separator is painted on the ground it sits on, not across a boundary',
  );
});

test('the line gives itself up in the order the owner ranked, not by width', () => {
  const extras = payloadExtras(fullPayload());
  const full: PowerlineInput = {
    ...extras,
    model: 'Opus 5',
    project: 'test_mycontext_plugin',
    branch: 'campaign/my-context-test',
    occupancy: { state: 'known', percent: 42, ageMs: 0 },
    threshold: THRESHOLD,
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
    focus: null,
    lastAudit: null,
    myctxNote: null,
    teeNote: null,
  };
  const at = (columns: number): string[] =>
    fitSegments(buildSegments(full, NOW), columns).map((s) => s.text);

  // Widest-first would give up `test_mycontext_plugin` and then the rate-limit
  // windows long before the model name. Rank-first gives up cost and cache
  // first, and keeps both windows until nothing but the context figure is left.
  assert.ok(!at(120).includes('$0.42 · warm 99.1%'), 'cost and cache go first');
  assert.ok(at(120).includes(`${LEVEL_GLYPH.ok} 7d 49% ·1d4h`));
  assert.ok(!at(100).includes('myctx 6.2k'), 'the share goes before the windows');
  assert.ok(at(100).includes(`${LEVEL_GLYPH.ok} 5h 12% ·3h12m`));
  assert.ok(!at(100).includes('test_mycontext_plugin'), 'the project name goes before the windows');
  assert.ok(at(95).includes('Opus 5 high think'), 'the model outlives the project');
  assert.ok(at(60).includes(`${LEVEL_GLYPH.ok} 7d 49% ·1d4h`), 'the windows are the last real blocks');
  assert.ok(at(60).includes(`${LEVEL_GLYPH.ok} 5h 12% ·3h12m`));
  // The context figure is no longer the last BLOCK — it is the anchor, with
  // the windows drawn to its right — so what is pinned is that it is still
  // there, which is the claim that mattered.
  assert.ok(at(40).includes(`${LEVEL_GLYPH.ok} ctx 42.0%`));
  assert.deepEqual(
    at(16), [`${LEVEL_GLYPH.ok} ctx 42.0%`],
    'the context figure is the one thing never given up',
  );
  // Below the width of its own block it gives up the GLYPH and keeps the
  // number: the colour still carries the level, and the figure itself is never
  // shortened. This is the floor.
  assert.deepEqual(at(11), ['ctx 42.0%']);

  // And every width in between still fits and still carries it.
  // 9 cells is the bare figure itself, which is never shortened.
  for (let w = 170; w >= 9; w--) {
    const rendered = renderPowerline(fitSegments(buildSegments(full, NOW), w), {
      colour: false, columns: w,
    });
    assert.ok(displayWidth(rendered) <= w, `${w} columns, ${displayWidth(rendered)} wide`);
    assert.match(rendered, /ctx 42\.0%/);
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
  // A width rule that widened `SEP` or a box-drawing cell would elide branches
  // that already fitted — the regression the ORIGINAL note was guarding.
  for (const one of [SEP, SEP_THIN, CAP_LEFT, CAP_RIGHT, '…', '·', '$', 'a', '7']) {
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
