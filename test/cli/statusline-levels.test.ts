/**
 * **THE FOUR LEVELS, THE BAR, THE ICONS, AND THE SEAM THAT MUST NOT SURVIVE.**
 *
 * Owner ruling, 2026-09-01: every field on the bar that expresses *amount used
 * out of a maximum* takes one identical treatment — a level icon, a ten-cell
 * bar, a percentage and a count pair — banded into four levels rather than
 * three. This file holds the arithmetic of that ruling, the honesty rules that
 * decided where it does NOT apply, and the tripwire on the phase-2 lift.
 *
 * **What it deliberately does not test:** appearance. Nothing here asserts that
 * a bar "looks right"; it asserts widths, boundaries, distinctness and the
 * three ways the treatment degrades. The rendering itself is verified by
 * driving real captured payloads through the command, which is a thing a test
 * cannot do for you.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BAR_CELLS, BAR_EMPTY, BAR_FILL, LEVEL_ICON, LEVEL_INK, PALETTE, usageBands,
  askSegment, buildLines, buildSegments, contextSegment, displayWidth, fmtCount,
  handoverSegment, rateLimitSegment,
  renderPowerline, renderStatusLine, usageBar, usageLevelOf, usedOfMaxSegment,
  type HandoverAskView, type OccupancyView, type PowerlineInput, type Segment, type UsageLevel,
} from '../../src/cli/commands/statusline-powerline.ts';
import { NO_BLINK_ENV, ONE_LINE_ENV, statusLineText } from '../../src/cli/commands/statusline.ts';

const TERMINAL = path.join(
  import.meta.dirname, '..', '..', 'src', 'cli', 'commands', 'statusline-powerline.ts',
);
const VIEWMODEL = path.join(
  import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'lib', 'viewmodel.js',
);
const web = await import(new URL(`file://${VIEWMODEL.split(path.sep).join('/')}`).href) as {
  CONTEXT_FILL_WARN_PERCENT: number;
  CONTEXT_FILL_CRIT_PERCENT: number;
};

/**
 * The four-level boundaries, READ from the shared module rather than typed
 * here. They moved into `lib/viewmodel.js` in phase 2 (2026-09-01); a literal
 * in a test is the same defect as a literal in the renderer, one step further
 * from where anyone would look for it.
 */
const BANDS = usageBands()!;
assert.ok(BANDS !== null, 'the shared band module did not load');

/** Source with comments removed, so a name in prose is not read as a declaration. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
}

const LEVELS: UsageLevel[] = ['safe', 'caution', 'warning', 'critical'];

function occ(percent: number, ageMs = 0): OccupancyView {
  return {
    state: 'known',
    percent,
    ageMs,
    usedTokens: Math.round(percent * 10_000),
    windowSize: 1_000_000,
  };
}

/* ══ THE BANDS ═════════════════════════════════════════════════════════════ */

test('four bands, and the boundary belongs to the band above it', () => {
  // `>=` on every boundary, the same convention `fillLevel` already uses, so a
  // reader who has learned one has learned both. A figure sitting exactly on
  // 80 is `critical` and not one step below it.
  assert.equal(usageLevelOf(0), 'safe');
  assert.equal(usageLevelOf(BANDS.caution - 0.1), 'safe');
  assert.equal(usageLevelOf(BANDS.caution), 'caution');
  assert.equal(usageLevelOf(BANDS.warning - 0.1), 'caution');
  assert.equal(usageLevelOf(BANDS.warning), 'warning');
  assert.equal(usageLevelOf(BANDS.critical - 0.1), 'warning');
  assert.equal(usageLevelOf(BANDS.critical), 'critical');
});

test('the bands are ordered, and nothing sits between two of them', () => {
  const seen = new Set<string>();
  let previous = 0;
  for (let pct = 0; pct <= 130; pct += 0.1) {
    const level = usageLevelOf(pct);
    assert.ok(level !== null, `no band at ${pct}`);
    const rank = LEVELS.indexOf(level!);
    assert.ok(rank >= previous, `the band went BACKWARDS at ${pct}: ${level}`);
    previous = rank;
    seen.add(level!);
  }
  assert.deepEqual([...seen].sort(), [...LEVELS].sort(), 'all four bands are reachable');
});

test('a figure past its maximum is critical, and is NOT clamped to 100', () => {
  // A context percentage past the handover threshold genuinely exceeds its
  // maximum. Clamping belongs to the BAR, which has ten cells; the verdict has
  // no such limit and inventing one would make 104% and 100% the same fact.
  assert.equal(usageLevelOf(100), 'critical');
  assert.equal(usageLevelOf(104), 'critical');
  assert.equal(usageLevelOf(1000), 'critical');
});

test('nothing to band answers null rather than a guessed safe', () => {
  assert.equal(usageLevelOf(Number.NaN), null);
  assert.equal(usageLevelOf(Number.POSITIVE_INFINITY), null);
  assert.equal(usageLevelOf('40' as unknown as number), null);
});

/* ══ THE SHARED CONTRACT, AND THE TRIPWIRE ON THE PHASE-2 LIFT ════════════ */

test('the caution boundary equals the web fill-warn boundary it stands beside', () => {
  // 60 in two places for the length of one phase. PINNED rather than assumed,
  // so the web's 60 moving fails here instead of parting in silence.
  assert.equal(BANDS.caution, web.CONTEXT_FILL_WARN_PERCENT,
    'the terminal caution band and the web fill-warn band have parted');
});

test('the critical boundary MOVED, and the move is recorded rather than silent', () => {
  // The owner's table puts `critical` at 80; the old absolute scale put `crit`
  // at 85. 80-85 is banded one step higher than it used to be, on purpose.
  // Asserted so that nobody later "fixes" the difference by aligning them.
  assert.equal(BANDS.critical, 80);
  assert.equal(web.CONTEXT_FILL_CRIT_PERCENT, 85);
  assert.notEqual(BANDS.critical, web.CONTEXT_FILL_CRIT_PERCENT);
});

test('the four levels belong to the WEB now — the phase-2 lift, tripwire fired', () => {
  // ── THIS TEST USED TO BE A TRIPWIRE, AND IT WENT OFF ─────────────────────
  //
  // Until 2026-09-01 it asserted that `viewmodel.js` did NOT declare these
  // names, because the three boundaries and `usageLevelOf` were restated in
  // `statusline-powerline.ts` for exactly one phase. Extending `fillLevel`'s
  // return set without its `app.js` consumers would have greyed the strip's
  // context figure and both rate chips and LABELLED a `caution` window
  // "comfortable" — a false verdict on a surface — so the terminal took the
  // four levels alone while the web caught up.
  //
  // The web has caught up. The tripwire failed, as written, the moment
  // `viewmodel.js` gained the names; the restatement it was guarding has been
  // deleted; and what it turns into is the assertion that keeps the lift
  // honest — the names are THERE, and they are not ALSO here.
  const source = readFileSync(VIEWMODEL, 'utf8');
  for (const name of ['USAGE_CAUTION_PERCENT', 'USAGE_WARNING_PERCENT',
    'USAGE_CRITICAL_PERCENT', 'usageLevelOf', 'usageBar', 'fmtCount']) {
    assert.ok(source.includes(name), `viewmodel.js must declare \`${name}\` after the lift`);
  }
  // ── AND NOT A SECOND COPY IN THE TERMINAL ────────────────────────────────
  // The restatement is what the tripwire existed to end, so its absence is
  // asserted rather than assumed: no boundary literal, and no comparison
  // against one, may reappear in the CLI module.
  const cli = stripComments(readFileSync(TERMINAL, 'utf8'));
  for (const literal of ['USAGE_CAUTION_PERCENT =', 'USAGE_WARNING_PERCENT =',
    'USAGE_CRITICAL_PERCENT =']) {
    assert.ok(!cli.includes(literal),
      `the CLI declares ${literal} again — the lift is meant to have removed it`);
  }
  assert.doesNotMatch(cli, />=\s*(60|70|80)/,
    'a four-level boundary is compared against a literal in the CLI again');
});

/* ══ THE BAR ══════════════════════════════════════════════════════════════ */

test('the bar is always BAR_CELLS cells wide, whatever the figure', () => {
  for (const pct of [-50, 0, 0.4, 5, 45, 99.9, 100, 104, 1000, Number.NaN]) {
    const bar = usageBar(pct);
    assert.equal(displayWidth(bar), BAR_CELLS, `"${bar}" at ${pct}`);
  }
});

test('the bar is built from ONE constant pair, so the style is a one-line change', () => {
  // The owner named `▰▰▰▱▱▱` and `■■■□□□` and chose the first. Both characters
  // come from this pair and nowhere else, which is what makes the other a
  // one-line change rather than a search across a renderer.
  assert.equal(displayWidth(BAR_FILL), 1, 'a fill cell is one column');
  assert.equal(displayWidth(BAR_EMPTY), 1, 'an empty cell is one column');
  assert.notEqual(BAR_FILL, BAR_EMPTY);
  for (const pct of [0, 17, 50, 83, 100]) {
    const bar = usageBar(pct);
    assert.equal([...bar].filter((c) => c !== BAR_FILL && c !== BAR_EMPTY).length, 0,
      `"${bar}" contains a character from neither constant`);
  }
});

test('the bar rounds rather than floors, so "almost none" is not drawn as "none"', () => {
  assert.equal(usageBar(0), BAR_EMPTY.repeat(BAR_CELLS));
  assert.equal(usageBar(6), BAR_FILL + BAR_EMPTY.repeat(BAR_CELLS - 1));
  assert.equal(usageBar(100), BAR_FILL.repeat(BAR_CELLS));
  // Clamped at both ends: no eleventh cell to fill, no cell below zero to empty.
  assert.equal(usageBar(140), BAR_FILL.repeat(BAR_CELLS));
  assert.equal(usageBar(-20), BAR_EMPTY.repeat(BAR_CELLS));
});

/* ══ THE ICONS AND THE HUES ═══════════════════════════════════════════════ */

test('every icon is two display cells, and safe carries none', () => {
  // The width rule was fixed BEFORE these existed (§8). Five fields' worth of
  // undercount is a wrapped line, and wrapping is the one failure the renderer
  // must not have.
  assert.equal(LEVEL_ICON.safe, '', 'a calm bar is quiet');
  for (const level of ['caution', 'warning', 'critical'] as const) {
    assert.equal(displayWidth(LEVEL_ICON[level]), 2, `${level}'s icon is two cells`);
  }
});

test('the icons are all different, so the hue is never the only carrier', () => {
  const drawn = LEVELS.map((l) => LEVEL_ICON[l]);
  assert.equal(new Set(drawn).size, drawn.length, 'two levels share an icon');
});

test('the four levels use four EXISTING tokens — no sixth hue was invented', () => {
  // `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` forbids a
  // sixth. Every level's ink must be one of the inks this file already
  // declares, and the four must be distinct or the ramp has three steps.
  const declared = Object.values(PALETTE).map((ink) => ink.fg);
  const used = LEVELS.map((l) => LEVEL_INK[l].fg);
  for (const ink of used) {
    assert.ok(declared.includes(ink), `${ink} is not one of the declared inks — a sixth hue`);
  }
  assert.equal(new Set(used).size, 4, 'two levels share a hue');
});

test('the ask marker is no longer gold, because gold became the caution band', () => {
  // Owner ruling, 2026-09-01: one hue, one job. Gold went wholly to `caution`
  // and the `◆ ask` marker left it, so the two are not the same colour one
  // block apart on the same row.
  assert.equal(LEVEL_INK.caution.fg, PALETTE['gold']?.fg, 'caution is gold');
  const due = askSegment(occ(90), 85);
  // ── SUPERSEDED SHAPE, `plan:handover seq:13` ────────────────────────────
  // The block past the ask was `◆ handover due` in `--carry`. Since `seq:12`
  // the ask is a SERIES — one per whole percent from the threshold to 100 —
  // and a words-only block said the same three words for fifteen points of
  // the window while up to sixteen asks went out inside it. The measurement
  // now continues past the threshold, re-origined on it, so this block takes
  // its BAND's ink like every other used-of-maximum field. The rule this
  // assertion protects is unchanged and is the only one it ever protected:
  // whatever hue the ask block wears, it is never gold.
  assert.equal(due?.label, 'ASK DUE', 'the words moved to the name, they did not vanish');
  assert.notEqual(due?.ink.fg, PALETTE['gold']?.fg, 'and it is NOT gold');
  // At 90% of a 85-threshold window the series is a third spent, which is
  // `safe` — so the ink is the calm band and NOT a permanent alarm. That is
  // the escalation a flat `--carry` could not do.
  assert.equal(due?.ink.fg, LEVEL_INK.safe.fg);
});

/* ══ THE TREATMENT, ON EVERY USED-OF-MAXIMUM FIELD ════════════════════════ */

/** Every used-of-max block on a bar built from one input. */
function usedOfMaxBlocks(input: PowerlineInput): Segment[] {
  const { window, account } = buildLines(input, Date.now());
  const ids = new Set(['ask', 'context', 'rate-7d', 'rate-5h', 'myctx']);
  return [...window, ...account].filter((s) => s.field !== undefined && ids.has(s.field));
}

const INPUT: PowerlineInput = {
  model: 'Opus 5', modes: { effort: null, thinking: null, fastMode: null, exceeds200k: null },
  project: 'my-context', branch: 'main', sessionName: null, focus: null,
  occupancy: occ(65), threshold: 85, handoverAsk: null,
  fiveHour: { usedPercent: 72, resetsAt: null },
  sevenDay: { usedPercent: 88, resetsAt: null },
  costUsd: null,
  elapsedMs: null, warmPercent: null,
  myctx: { tokens: 264_500, injections: 3, unrecorded: 0 },
  lastAudit: null, myctxNote: null, teeNote: null, corpus: null,
  cwd: null, projectDir: null,
};

test('ALL FIVE used-of-maximum fields get the identical treatment', () => {
  // The half of the ruling that was easy to under-read: *"use the same
  // controls for every field that displays amount used from maximum
  // available"*. Derived from what `buildLines` actually emits, so a field
  // that quietly stopped taking the treatment fails here by name.
  const blocks = usedOfMaxBlocks(INPUT);
  assert.deepEqual(blocks.map((b) => b.field).sort(),
    ['ask', 'context', 'myctx', 'rate-5h', 'rate-7d']);
  for (const b of blocks) {
    assert.match(b.text, new RegExp(`[${BAR_FILL}${BAR_EMPTY}]{${BAR_CELLS}}`),
      `${b.field} draws no bar: "${b.text}"`);
    assert.match(b.text, /\d+(\.\d+)?%/, `${b.field} draws no percentage: "${b.text}"`);
  }
});

test('the icon appears on every banded field and on no safe one', () => {
  for (const pct of [30, 65, 75, 90]) {
    const level = usageLevelOf(pct)!;
    const seg = usedOfMaxSegment({
      field: 'context', percent: pct, counts: null, decimals: 1, suffix: '',
    });
    if (level === 'safe') assert.ok(!/[\u{1F300}-\u{1FAFF}⚠]/u.test(seg.text), 'safe is quiet');
    else assert.ok(seg.text.startsWith(LEVEL_ICON[level]), `${pct}% should lead with ${level}'s icon`);
  }
});

test('the two rate windows get icon, bar and percentage — and NO invented counts', () => {
  // The payload carries `used_percentage` for these windows and nothing else:
  // no token count, no message count, no denominator at any level. `(59 / 100)`
  // would print one number twice wearing a slash and invent a maximum nobody
  // served. This is the honesty rule that kept the row inside the terminal.
  const seg = rateLimitSegment({ usedPercent: 88, resetsAt: null }, Date.now(), 90, 'rate-7d');
  assert.ok(seg !== null);
  assert.match(seg!.text, new RegExp(`[${BAR_FILL}${BAR_EMPTY}]{${BAR_CELLS}}`));
  assert.match(seg!.text, /88%/);
  assert.ok(seg!.text.startsWith(LEVEL_ICON.critical), 'still banded and still iconned');
  assert.ok(!seg!.text.includes('/'), `a count pair was invented: "${seg!.text}"`);
});

test('the context and ask fields DO carry counts, because they have a real maximum', () => {
  const ctx = contextSegment(occ(54.9));
  assert.ok(ctx.text.includes('(549.0k / 1.0M)'), 'real numerator, real denominator');
  const ask = askSegment(occ(65), 85);
  // The maximum is the THRESHOLD, and both numbers are percentage points of
  // the window, so the pair reads in the same units as the ctx figure beside it.
  assert.match(ask?.text ?? '', /\(65\.0 \/ 85\)/);
  assert.match(ask?.text ?? '', /\b76%/, '65 of 85 is 76% of the way to the ask');
});

test('myctx is banded against the window, and says nothing when there is no window', () => {
  const banded = usedOfMaxBlocks(INPUT).find((b) => b.field === 'myctx');
  // The NAME is a label now, so the field is `MYCTX` + its value rather than
  // a value that spells its own name. Since 2026-09-04 the label also always
  // carries the `≈`/`≥` qualifier — `context-share.ts` charges each item
  // once rather than once per delivery, and can only BOUND what is resident,
  // never measure it, so a figure that cannot be exact is never drawn bare.
  assert.equal(banded?.label, 'MYCTX ≈');
  assert.match(banded?.text ?? '', /26\.5% \(264\.5k \/ 1\.0M\)/);
  // No measurable window means no maximum, so it falls back to the bare count
  // it always drew rather than switching denominators in silence — the
  // qualifier rides the TEXT there instead of the label, because that
  // fallback draws no label of its own to ride.
  const blind = buildLines(
    { ...INPUT, occupancy: { state: 'unmeasurable', why: 'no-sample' } }, Date.now(),
  );
  const bare = [...blind.account].find((s) => s.field === 'myctx');
  assert.equal(bare?.label, 'MYCTX');
  assert.equal(bare?.text, '≈264.5k', 'no window, no percentage — and no invented one');
});

test('past the ask the bar re-origins on the threshold and keeps moving', () => {
  // ── SUPERSEDES 'past the ask the words take over' — `plan:handover seq:13`.
  //
  // The 2026-09-01 ruling was that *past the ask the number stops being the
  // point, the action is*, and that was right while the ask was ONE EVENT.
  // `seq:12` made it a series of up to sixteen, one per whole percent from the
  // threshold to full — so a words-only block said an identical sentence at
  // 85% and at 99%, over exactly the stretch where every ask happens, and a
  // bar frozen at ten filled cells read as FINISHED. The action did not lose
  // its place: it is the field's NAME now (`ASK DUE`), which is said on all
  // sixteen steps instead of instead of them.
  //
  // What this test now pins is that the measurement CONTINUES, and that it is
  // measured from the threshold rather than from zero — so it is not the
  // window figure beside it wearing a second label.
  const below = askSegment(occ(75), 85);
  assert.match(below?.text ?? '', new RegExp(`[${BAR_FILL}${BAR_EMPTY}]{${BAR_CELLS}}`));
  assert.equal(below?.label, 'ASK');

  const seen: string[] = [];
  for (const pct of [85, 88, 99]) {
    const at = askSegment(occ(pct), 85);
    assert.equal(at?.label, 'ASK DUE', `${pct}% still says the action, in the name`);
    assert.match(at?.text ?? '', new RegExp(`[${BAR_FILL}${BAR_EMPTY}]{${BAR_CELLS}}`),
      `${pct}% should still carry a bar — a field that stops measuring reads as finished`);
    // Measured from the THRESHOLD: at 85 the series is untouched, so the
    // proportion is 0 and not 100. A `(85.0 / 85)` here would be the old
    // over-full block, and a `85%` would be the window figure duplicated.
    assert.match(at?.text ?? '', /\(\d+\.\d \/ 15\)/, 'the maximum is the span to full');
    seen.push(at?.text ?? '');
  }
  assert.equal(new Set(seen).size, seen.length,
    'the block said the same thing at three different fills — which is the defect');
  assert.match(seen[0]!, /\(0\.0 \/ 15\) ·\+15\.0 ·15 left/,
    'at the threshold nothing of the series is spent and every ask is still to come');
  assert.match(seen[2]!, /\(14\.0 \/ 15\) ·\+1\.0 ·1 left/,
    'at 99% one point and one ask are left');
});

test('a fossil keeps its number and loses its verdict', () => {
  // A reading too old to band is drawn without an icon and without a hue —
  // visibly not-a-verdict rather than a confident one.
  const fossil = usedOfMaxSegment({
    field: 'context', percent: 95, counts: null, decimals: 1, suffix: '',
    ageMs: 48 * 60 * 60 * 1000,
  });
  assert.ok(!fossil.text.startsWith(LEVEL_ICON.critical), 'a fossil gets no skull');
  assert.equal(fossil.ink.fg, PALETTE['neutral']?.fg, 'and no band hue');
  assert.equal(fossil.blink, false);
  assert.match(fossil.text, /95\.0%/, 'the number itself is not withheld');
});

test('fmtCount reads in the register the counts are read in', () => {
  // ABBREVIATED, by the owner's ruling of 2026-09-01 (later): *"in order to
  // shorten numbers you can change them to K and M"*. That reversed the
  // full-and-comma-grouped form adopted a few hours earlier, and the reason
  // moved with it — every field is a bordered pill now and the digits were the
  // cheapest width to give back. See `fmtCount` for the whole history.
  assert.equal(fmtCount(549_009), '549.0k');
  assert.equal(fmtCount(1_000_000), '1.0M');
  assert.equal(fmtCount(200_000), '200.0k');
  assert.equal(fmtCount(42), '42');
  assert.equal(fmtCount(999), '999', 'no unit below a thousand');
  assert.equal(fmtCount(1_000), '1.0k', 'and one at exactly a thousand');
  // ONE DECIMAL on both units, and it is a stated choice rather than an
  // accident: `999,400` keeps its 999.4k rather than rounding to a whole
  // `999k`, so the abbreviation costs at most ~50 tokens of shown precision.
  assert.equal(fmtCount(999_400), '999.4k');
  // The unit changes at a million so the number never runs past four digits.
  assert.equal(fmtCount(1_234_567), '1.2M');
});

/* ══ BLINK: THE EXTRA, NEVER THE CARRIER ═════════════════════════════════ */

const CRIT: Segment[] = [{ text: 'x', ink: PALETTE['crit']!, bold: true, blink: true }];

test('only a critical block blinks, and bold is what actually carries it', () => {
  for (const pct of [30, 65, 75, 90]) {
    const seg = usedOfMaxSegment({
      field: 'context', percent: pct, counts: null, decimals: 1, suffix: '',
    });
    const critical = usageLevelOf(pct) === 'critical';
    assert.equal(seg.blink, critical, `blink at ${pct}%`);
    assert.equal(seg.bold, critical, `bold at ${pct}% — the carrier, not the blink`);
  }
});

test('SGR 5 opens on the critical block and SGR 25 closes it on every other', () => {
  // **A REQUIREMENT, not tidiness.** Blocks are painted in sequence into one
  // string, so a blink opened on the critical block stays open for every block
  // after it unless each one closes it.
  const mixed: Segment[] = [
    { text: 'crit', ink: PALETTE['crit']!, blink: true, bold: true },
    { text: 'calm', ink: PALETTE['ok']! },
    { text: 'also', ink: PALETTE['carry']! },
  ];
  const out = renderPowerline(mixed, { colour: true, columns: null });
  assert.equal((out.match(/\[5m/g) ?? []).length, 1, 'exactly one block opens the blink');
  // Every OTHER paint closes it, and since the frame went that includes the
  // SEPARATORS — `joint()` paints too, so the rule between two fields can no
  // longer inherit a blink from the field before it. Asserted as a PROPERTY
  // rather than a count, because the count moves with the field count.
  const opened = out.indexOf('[5m');
  const closed = out.indexOf('[25m', opened);
  assert.ok(closed > opened, 'nothing closed the blink after the critical field');
  assert.ok(!out.slice(closed).includes('[5m'), 'the blink reopened later');
});

test('no line ever ENDS with the blink open', () => {
  // Claude Code prepends every SGR from line 1 to line 2 cumulatively, so a
  // blink left open at end-of-line makes the whole next line blink.
  const rendered = renderStatusLine([CRIT, [{ text: 'y', ink: PALETTE['ok']! }]],
    { colour: true, columns: null });
  for (const line of rendered.split('\n')) {
    const last = [...line.matchAll(/\[(5|25|0)m/g)].pop();
    assert.ok(last !== undefined && last[1] !== '5',
      `this line ends with the blink still open: ${JSON.stringify(line)}`);
  }
});

test('the opt-out removes the escape and costs the level nothing that carries', () => {
  const on = renderPowerline(CRIT, { colour: true, columns: null });
  const off = renderPowerline(CRIT, { colour: true, columns: null, blink: false });
  assert.match(on, /\[5m/);
  assert.ok(!/\[5m/.test(off), 'the opt-out emits no SGR 5');
  assert.match(off, /\[1m/, 'and bold — the actual carrier — survives it');
  // The env var reaches it, shaped like the one-line switch it follows.
  const env = { [NO_BLINK_ENV]: '1' };
  const text = statusLineText(INPUT, true, null, env);
  assert.ok(!/\[5m/.test(text), `${NO_BLINK_ENV} did not reach the renderer`);
});

test('colour: false emits no blink either — an escape is an escape', () => {
  const plain = renderPowerline(CRIT, { colour: false, columns: null });
  assert.ok(!//.test(plain), 'not one escape byte, blink included');
});

/* ══ THE THIRD ROW ════════════════════════════════════════════════════════ */

test('the bar is THREE groups, and the window pair has its own row', () => {
  const { identity, window, account } = buildLines(INPUT, Date.now());
  assert.deepEqual(window.map((s) => s.field), ['ask', 'context'],
    'line 2 is the ask and the context figure, read as a pair and nothing else');
  assert.ok(identity.length > 0 && account.length > 0);
  for (const field of ['rate-7d', 'rate-5h', 'myctx']) {
    assert.ok(account.some((s) => s.field === field), `${field} belongs to the account row`);
  }
});

test('every row fits the owner’s terminal, at every level, with the icons on', () => {
  // The measurement that bought the third row: one line-2 carrying all five
  // treated fields came to 215 columns against a terminal of about 200.
  for (const pct of [45, 65, 75, 88]) {
    const text = statusLineText({ ...INPUT, occupancy: occ(pct) }, false, null, {});
    const rows = text.split('\n');
    assert.equal(rows.length, 3, `three rows at ${pct}%`);
    for (const row of rows) {
      assert.ok(displayWidth(row) <= 200,
        `at ${pct}% a row is ${displayWidth(row)} columns: ${row}`);
    }
  }
});

test('the one-line fallback still carries every field the three rows do', () => {
  // `buildSegments` is DERIVED from `buildLines` by concatenation, so the
  // fallback cannot contain a different set of blocks from the three-row form.
  // Compared as FIELDS rather than as text fragments: the two spellings are
  // entitled to differ in separators and padding, and never in what they say.
  const { identity, window, account } = buildLines(INPUT, Date.now());
  const rows = [...identity, ...window, ...account].map((seg) => seg.field);
  const flat = buildSegments(INPUT, Date.now()).map((seg) => seg.field);
  assert.deepEqual(flat, rows, 'the one-line form and the three-row form disagree');
  const one = statusLineText(INPUT, false, null, { [ONE_LINE_ENV]: '1' });
  assert.equal(one.split('\n').length, 1, 'the fallback is one line');
  assert.equal(statusLineText(INPUT, false, null, {}).split('\n').length, 3);
});

test('a narrow terminal falls back to the figure and still never wraps', () => {
  // The floor: the label and the number, which is what these fields said
  // before the ruling. The bar and the counts are the decoration; the FIGURE
  // is never shortened.
  for (let w = 200; w >= 12; w--) {
    const text = statusLineText(INPUT, false, w, {});
    for (const row of text.split('\n')) {
      assert.ok(displayWidth(row) <= w,
        `at ${w} columns a row is ${displayWidth(row)} wide: ${row}`);
    }
    assert.match(text, /42\.0%|65\.0%|WINDOW/, `the context block went at ${w} columns`);
  }
});

/* ══ THE HEADROOM — owner ruling, 2026-09-01, restoring 2026-08-31's ═══════ */

test('the ask block prints the DISTANCE, not only the ratio it can be derived from', () => {
  // The first cut of the used-of-maximum shape dropped this figure, on the
  // reasoning that `(65.0 / 85)` carries both numbers and the gap is one
  // subtraction away. The owner ruled it back: a distance a reader has to
  // COMPUTE is not one they read at a glance. So the block carries all four.
  const seg = askSegment(occ(65), 85);
  assert.match(seg?.text ?? '', new RegExp(`[${BAR_FILL}${BAR_EMPTY}]{${BAR_CELLS}}`), 'the bar');
  assert.match(seg?.text ?? '', /\b76%/, 'the proportion');
  assert.match(seg?.text ?? '', /\(65\.0 \/ 85\)/, 'the counts');
  assert.match(seg?.text ?? '', /·\+20\.0$/, 'and the gap, last and printed');
});

test('the gap is the threshold minus the fill, at one decimal, at every fill', () => {
  // Derived from the shared subtraction rather than restated, so a change to
  // `askHeadroom` moves the expectation with it instead of parting from it.
  for (const [pct, threshold] of [[25.1, 85], [42, 98], [70, 98], [81.8, 85]] as const) {
    const seg = askSegment(occ(pct), threshold);
    assert.ok(seg !== null, `${pct} of ${threshold}`);
    const gap = ` ·+${(threshold - pct).toFixed(1)}`;
    assert.ok(seg!.text.endsWith(gap),
      `${pct} of ${threshold}: expected to end with "${gap}", got "${seg!.text}"`);
  }
  // ONE decimal, always — this is the figure that MOVES, and `+3` for anything
  // between 2.5 and 3.5 hides the last message before the ask.
  assert.match(askSegment(occ(82), 85)?.text ?? '', /·\+3\.0$/);
  assert.match(askSegment(occ(81.8), 85)?.text ?? '', /·\+3\.2$/);
});

test('the gap SHRINKS as the window fills — a figure that did not move would be a decoration', () => {
  const gapAt = (pct: number): number => {
    const m = /·\+(\d+\.\d+)$/.exec(askSegment(occ(pct), 98)?.text ?? '');
    assert.ok(m !== null, `no gap printed at ${pct}%`);
    return Number(m![1]);
  };
  let previous = Number.POSITIVE_INFINITY;
  for (const pct of [10, 30, 50, 70, 90, 97]) {
    const gap = gapAt(pct);
    assert.ok(gap < previous, `the gap did not shrink from ${previous} at ${pct}%`);
    previous = gap;
  }
});

test('past the ask the gap counts to FULL, and is never negative or spent', () => {
  // ── SUPERSEDES 'past the ask the WORD stands alone' — `plan:handover
  //    seq:13`, and the thing it was protecting is what changed.
  //
  // The old block printed no figure past the ask because the only figure it
  // had was `threshold - pct`, which is negative there — and a `-3.0` beside
  // "handover due" invites a reader to act on a number that is spent. The
  // answer was to drop the figure; `seq:13`'s answer is to measure the right
  // distance instead. Past the ask the next boundary is FULL, so the gap
  // counts to 100 and shrinks all the way there. Never negative, never stuck.
  let previous = Number.POSITIVE_INFINITY;
  for (const pct of [85, 85.1, 90, 99.9]) {
    const seg = askSegment(occ(pct), 85);
    const gap = /·\+(\d+\.\d)/.exec(seg?.text ?? '');
    assert.ok(gap !== null, `at ${pct}% the block still answers a distance`);
    const value = Number(gap[1]);
    assert.equal(value, Number((100 - pct).toFixed(1)), 'the distance is to full');
    assert.ok(value < previous, `the gap did not shrink at ${pct}%`);
    previous = value;
    assert.ok(!/-\d/.test(seg?.text ?? ''), 'and it is never a negative figure');
  }
});

/* ══ THE HANDOVER VERDICT, IN PERCENT — `plan:handover seq:13` ═══════════ */

/**
 * **The block the terminal did not have, and the unit the strip had wrong.**
 *
 * The strip said `handover written 3h ago` and this bar said nothing at all.
 * Age is a proxy for currency and it is the proxy that failed: three windows on
 * this corpus reported `acted-on` while the handover was 2h39m, 1h24m and 3h06m
 * behind — written at 85% and carried to 99.9%, 96.1% and 96.6%. Every
 * assertion below is about the pair of PERCENTAGES that replaces it.
 */
const ASK = (verdict: HandoverAskView['verdict'], askedAtPercent: number | null = null)
  : HandoverAskView => ({ verdict, askedAtPercent });

test('the handover block says which percent the handover answers and which we are at', () => {
  // CURRENT: the ask it answers is the whole percent the window is in. The
  // only state that earns the calm hue, and it earns it on a COMPARISON rather
  // than on the ordering `acted-on` proves.
  const current = handoverSegment(ASK('acted-on', 96), occ(96.4), 85);
  assert.equal(current?.label, 'HANDOVER');
  assert.equal(current?.text, 'current at 96%');
  assert.equal(current?.ink.fg, PALETTE['ok']?.fg);

  // BEHIND: the pair, and the staleness is the two numbers that caused it.
  const behind = handoverSegment(ASK('acted-on', 85), occ(99.9), 85);
  assert.equal(behind?.text, 'written at 85%, now 99%');
  assert.equal(behind?.ink.fg, PALETTE['warn']?.fg);
  // `warn` and not `crit`: behind is not missing, and the loudest hue is owed
  // to the ask that went unanswered.
  assert.notEqual(behind?.ink.fg, PALETTE['crit']?.fg);

  // IGNORED, the state a reader would never think to check for.
  const ignored = handoverSegment(ASK('ignored', 96), occ(96.4), 85);
  assert.equal(ignored?.text, 'asked at 96%, not written');
  assert.equal(ignored?.ink.fg, PALETTE['crit']?.fg);
  assert.equal(ignored?.bold, true);

  // NOT ASKED is a measured not-yet, and it names the percent it starts at.
  assert.equal(handoverSegment(ASK('not-asked'), occ(20), 85)?.text, 'first ask at 85%');
  // A threshold that is not a whole number keeps its decimal, exactly as the
  // ask block's own count pair does.
  assert.equal(handoverSegment(ASK('not-asked'), occ(20), 92.5)?.text, 'first ask at 92.5%');
});

test('the handover block refuses a comparison it cannot honestly make', () => {
  // NO LIVE READING: asked and answered, and nothing to measure it against.
  // Never the calm hue — that would claim currency from a comparison nobody
  // made.
  const cold = handoverSegment(ASK('acted-on', 85), { state: 'unmeasurable', why: 'no-sample' }, 85);
  assert.equal(cold?.text, 'answers the 85% ask');
  assert.notEqual(cold?.ink.fg, PALETTE['ok']?.fg);

  // A FOSSIL is not a reading either. Same refusal, and it matters more: a
  // stale percentage measured against a live latch would print a confident
  // number about a window that has not existed for hours.
  const fossil = handoverSegment(ASK('acted-on', 85), occ(90, 48 * 60 * 60 * 1000), 85);
  assert.equal(fossil?.text, 'answers the 85% ask');

  // A LATCH ABOVE THIS WINDOW. A `/clear` destroys a context window and the
  // latch deliberately outlives it, so a fresh window can read a percent above
  // its own. Drawn as not known, never as `current at 96%` over a window at 12%.
  const prior = handoverSegment(ASK('acted-on', 96), occ(12), 85);
  assert.equal(prior?.text, 'answers 96%, above this window');
  assert.equal(prior?.ink.fg, PALETTE['neutral']?.fg);

  // UNVERIFIABLE is never folded into ignored: a charge nothing supports is
  // the same defect as a guarantee nothing supports.
  assert.equal(handoverSegment(ASK('unverifiable', 90), occ(96), 85)?.text, 'state not known');

  // `off` draws NOTHING on a line redrawn on every assistant message — a
  // sentence that is identical forever is furniture. `null` is not `off`: the
  // question could not be asked at all.
  assert.equal(handoverSegment(ASK('off'), occ(96), null), null);
  assert.equal(handoverSegment(null, occ(96), 85), null);
});

test('the gap is silent where the whole block is — no ask, and no current reading', () => {
  // Nothing is claimed about proximity to an ask that does not exist, or from
  // a reading too old to present as current.
  assert.equal(askSegment(occ(65), null), null, 'no threshold configured, no distance to it');
  assert.equal(askSegment({ state: 'unmeasurable', why: 'no-sample' }, 85), null);
  assert.equal(askSegment(occ(65, 48 * 60 * 60 * 1000), 85), null, 'a fossil claims no distance');
});

test('the gap is the only leading + on the bar, which is what marks it a distance', () => {
  // `%` marks a proportion, `$` money, `·` a trailing qualifier. Nothing else
  // wears a leading plus, so the token cannot be misread as a fourth ratio.
  const { identity, window, account } = buildLines(INPUT, Date.now());
  const plussed = [...identity, ...window, ...account]
    .filter((s) => /\+/.test(s.text)).map((s) => s.field);
  assert.deepEqual(plussed, ['ask'], 'some other block grew a + and now competes with the gap');
});
