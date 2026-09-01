// src/ui/public/lib/viewmodel.js
// The screens' pure logic: everything a Watch or Ask view decides before a
// single element is created. `node --test` imports this file directly
// (test/ui/viewmodel.test.ts), which is the whole reason the decisions live
// here rather than in the DOM glue — per spec §6 the glue is the stated
// rendering-coverage gap, so nothing that can be decided may be decided there.
//
// A plain browser ES module: no types (the browser cannot strip them), no
// imports, no build step. The bytes the browser loads are the bytes the test
// loads.
//
// Plan 1's helpers (`selectQuery`, `budgetBar`, `buildTree`, `coverageGaps`,
// `layoutGraph`, `groupFindings`, `decayBuckets`, `renderMarkdown`) join this
// file when its Tasks 17-19 land; plan 3 Task 10 opened it because they had
// not.

// --- Watch/Ask view-models (web-ui plan 3) ----------------------------------

// The one place absence-vs-zero is decided for the DOM: an injection record
// without `tokens` predates the field and means NOT RECORDED — never zero.
// Zero is a real measurement (everything selected spilled). audit.ts pins
// this on the field itself
// (`core/audit.ts` · `ABSENT on records written before this field existed, and absence means` · ~366);
// this function is that contract applied to rendering, and the test pins both
// directions.
//
// There are SEVEN kinds (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~242),
// and `injected`/`spilled`/`tokens` belong to exactly one of them. The other
// six come back with an empty spill list and a `null` token count — not
// "not-recorded", which is a claim about a field that kind never carries.
//
// `command` is `execution`'s own field and is carried the same way `hook` and
// `fields` are: present when the record has one, `null` otherwise. Without it
// an execution row reaches the watch screen with no id, no argv and no exit
// code — a row saying something ran and refusing to say what, which is the
// one thing an audit surface may not do.
import { composeCommand } from './command.js';

export function describeRecord(record) {
  const injection = record.kind === 'injection';
  return {
    at: record.at,
    kind: record.kind,
    op: record.op,
    sessionId: record.sessionId ?? null,
    injected: injection ? (record.injected ?? []).length : 0,
    spilled: injection ? (record.spilled ?? []) : [],
    tokens: !injection ? null : (typeof record.tokens === 'number' ? record.tokens : 'not-recorded'),
    itemId: record.itemId ?? null,
    origin: record.origin ?? null,
    path: record.path ?? null,
    note: record.note ?? null,
    // **The kind-specific fields, which this used to drop on the floor.**
    //
    // `AuditRecord` carries a different payload per kind — `hook` names the
    // platform event (`SessionStart`, `PreToolUse`, …), `refusal` says which
    // check turned a request away, `fields` says which of an item's fields a
    // mutation touched. None of them were copied here, so the screen could not
    // render them however it was written: an `access` row could only ever say
    // `ui-refused` and never why, and a `hook` row showed its OP where the
    // design of record shows the EVENT.
    //
    // The mockup's own rows are the specification, and each kind gets its own
    // sentence there — `SessionStart — 2 pinned, 7 index`, `ui-refused — …`,
    // `step-done — PROC-release-checklist, step 3 of 7`. One generic
    // op/itemId/note/path line satisfied `mutation` by coincidence (its shape
    // happens to be op plus id) and nothing else. Found by the owner looking at
    // the two screens side by side; the element-kind parity gate is blind to it
    // because every one of those rows is the same `bdi` and `span.m`.
    hook: record.hook ?? null,
    refusal: record.refusal ?? null,
    fields: Array.isArray(record.fields) ? record.fields : null,
  };
}

function sortedJson(value) {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${sortedJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Records carry no id; the stream-vs-backlog overlap is deduped by full
// serialized identity (plan 3 design decision 1). Two records that are equal
// in every field — same op, same session, same millisecond — therefore have
// one key and the feed shows one row. That is the trade the decision makes
// knowingly: inventing an id server-side would be a second truth about a log
// whose whole value is being the first one.
export function dedupeKey(record) {
  return sortedJson(record);
}

export function formatAge(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * **THE ONE SPELLING OF A DURATION, for both surfaces.** Owner ruling,
 * 2026-09-01: *"every field that is also displayed on the terminal status line
 * should have exactly the same value in the web status bar full resolution
 * like hours and minutes"*.
 *
 * There were FOUR copies of this arithmetic when that ruling landed --
 * `elapsed`, `since` and `until` in `statusline-powerline.ts`, and
 * `untilReset` here -- beside a fifth spelling, `formatAge`, that rounds to a
 * SINGLE unit. That is why the strip drew `5d` where the terminal drew `5d 8h`
 * for the same millisecond count: not a bug in either formatter, but the
 * absence of one. Four hand-kept copies that must agree is the defect this
 * project has now measured ten times.
 *
 * `sep` is the ONLY thing the two surfaces may differ on, because the owner
 * drew both spellings: a bare elapsed clock reads `5d 8h`, a qualifier bolted
 * to a field reads `1d3h`. Same value, same resolution, same boundaries -- one
 * space. `test/ui/duration-parity.test.ts` sweeps both against each other, so
 * the terminal's copy cannot drift from this one.
 *
 * `null` for anything that is not a duration, which draws an unmeasured field
 * rather than `0m`: a length nobody reported is not a length of zero
 * (`STD-a-measured-zero-is-drawn-and-named`).
 */
export function formatDuration(ms, sep = '') {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'now';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `${days}d${sep}${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h${sep}${mins}m` : `${hours}h`;
  return `${mins}m`;
}

/* ══ THE OCCUPANCY BANDS — DERIVED FROM THE THRESHOLD, NEVER FROM TASTE ════
 *
 * `plan:walk seq:117`. The context figure carried no colour at all, so a
 * reader could see a percentage and not see how much runway was left.
 *
 * ── THE MEASUREMENT THAT SETTLES IT ───────────────────────────────
 *
 * Every `pre-compact` record carries `occupancyPercent` and `trigger`, and two
 * automatic compactions stand on the live audit log:
 *
 *     2026-08-29  auto  99.7147%
 *     2026-08-28  auto  99.809%
 *
 * So Claude Code's own auto-compaction fires at ~99.75%, and 98 — the value
 * `handoverThresholdPercent()` resolves to when nothing is configured — IS
 * reachable. That settles the standing concern recorded in `config.ts`. What it
 * also says is why colouring AT the threshold would be useless: a bar that only
 * leaves green at 98 gives a reader about 1.75 points of runway before the
 * window is compacted out from under them, which is not enough to finish a
 * thought, capture a lesson, or write a handover deliberately.
 *
 * ── SO THE WARN BAND OPENS A TENTH OF THE WINDOW BEFORE THE ASK ─────────
 *
 *     crit   pct >= T                    the ask fires here
 *     warn   pct >= T * 0.9              approaching it, with room to act
 *     ok     below that                  comfortably below the ask
 *
 * `T` is `handoverThresholdPercent`, SERVED by `/api/watch/context` and never
 * spelled here: the value is configurable, `core/config.ts` names one place
 * where its default is applied, and a constant in a browser would be a second
 * one. At the current T = 98 the warn band opens at 88.2%, which is 9.8 points
 * of runway — five and a half times the 1.75 a reader gets between the ask and
 * the measured auto-compaction. Move the threshold to 80 and the warn band
 * moves to 72 with it, which is the property that makes this derived rather
 * than chosen.
 *
 * A FRACTION of the threshold rather than a fixed offset below it, because an
 * offset is a second number with its own units: "eight points below" is
 * arbitrary at T=98 and absurd at T=10, while "the last tenth of the way there"
 * says the same thing at every T and cannot go negative.
 *
 * **Three levels, three existing hues — ok, warn, crit.** No sixth is invented
 * (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`), and
 * colour is never the only carrier: the caller draws a chip with a WORD in it
 * and the percentage stays a number beside it.
 */
export const OCCUPANCY_WARN_FRACTION = 0.9;

/**
 * The two boundaries, in percentage points, for a threshold of `threshold`.
 *
 * `null` in, `null` out: with the handover feature off there is no ask, so
 * there is no level to name a band against and the caller draws none.
 */
export function occupancyBands(threshold) {
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) return null;
  return { warn: threshold * OCCUPANCY_WARN_FRACTION, crit: threshold };
}

/**
 * **HOW FAR THE ASK IS, IN POINTS OF THE WINDOW — one spelling, two surfaces.**
 *
 * `threshold - pct`, and the reason it is a function rather than a subtraction
 * written twice is the reason `occupancyBands` is: the terminal bar draws
 * `◆ ask 85 · +59.9` and the web strip draws the same distance beside the same
 * gold marker, and two spellings of one arithmetic is how two surfaces come to
 * disagree about one number. `cli/commands/statusline-powerline.ts` reaches
 * this through the same `import()` bridge it reaches `occupancyLevel` through.
 *
 * `null` when there is nothing to subtract — no percentage, or no configured
 * ask to measure a distance to. A headroom measured against a threshold nobody
 * set would be a number invented by the renderer.
 *
 * NOT clamped at zero: a window past the ask has NEGATIVE headroom and that is
 * a true fact about it. Both surfaces stop drawing the figure there and let the
 * gold "handover due" say it instead, but that is a rendering choice made by
 * each of them, not a lie told here.
 */
export function askHeadroom(pct, threshold) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) return null;
  return threshold - pct;
}

/**
 * **How old a context sample may be and still be levelled.**
 *
 * `plan:walk seq:117`: *"Do not colour a stale figure as though it were live.
 * The strip already discloses age — a fossil rendered in confident red is
 * worse than an uncoloured number."*
 *
 * The tee this figure comes from is rewritten by `mycontext statusline` on
 * Claude Code's own per-message hook, so in a session somebody is working in it
 * is refreshed once per assistant response — seconds to a couple of minutes
 * apart. Fifteen minutes is an order of magnitude past that: long enough that
 * no ordinary pause between turns trips it, short enough that a session nobody
 * is in stops being drawn as a live reading. It is not a claim about how long
 * the number stays TRUE — nothing here can know that — it is the point past
 * which this page may no longer present it as current.
 *
 * The live corpus is the case that argues for it: its own sample reads 60.1%
 * and was received 29 hours ago. Levelled, that is a confident green about a
 * window that no longer exists.
 *
 * ── THE SERVER OWNS IT NOW, AND THIS RESTATES IT BY NAME ──────────────────
 *
 * `plan:walk seq:123`. This constant used to exist ONLY here, which meant only
 * this page enforced it: `core/context-occupancy.ts` · `readOccupancy` handed
 * `Stop` and `PreCompact` a confident percentage off the same 29-hour-old
 * sample the chip below was refusing to colour. One product, two answers about
 * one file. The declaration now lives beside the reading it gates —
 * `core/context-occupancy.ts` · `export const CONTEXT_SAMPLE_FRESH_MS` — and
 * this is a browser ES module that cannot import a `.ts` one, so the value is
 * restated here by NAME with the original named beside it, exactly the way
 * `lib/live-invalidation.js` · `export const STREAM_POLL_MS` restates the
 * server's tail interval. `test/ui/viewmodel.test.ts` imports both and fails if
 * they ever differ, so the mirror cannot rot in silence.
 */
export const CONTEXT_SAMPLE_FRESH_MS = 15 * 60_000;

/**
 * The band a live occupancy figure falls in — `'ok'`, `'warn'`, `'crit'` — or
 * `'stale'` for a sample too old to be levelled, or `null` when there is
 * nothing to level (no percentage, or no threshold to name bands against).
 *
 * `ageMs` is the caller's, computed from `receivedAt` at RENDER time for the
 * same reason the "as of … ago" label is: a number frozen at fetch time is
 * exactly what an age must not be.
 *
 * `>=` on both boundaries, so a figure sitting exactly on the threshold is AT
 * the ask rather than one step below it.
 */
export function occupancyLevel(pct, threshold, ageMs) {
  const bands = occupancyBands(threshold);
  if (bands === null) return null;
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  if (typeof ageMs === 'number' && Number.isFinite(ageMs) && ageMs > CONTEXT_SAMPLE_FRESH_MS) {
    return 'stale';
  }
  if (pct >= bands.crit) return 'crit';
  if (pct >= bands.warn) return 'warn';
  return 'ok';
}

/* ══ AND THE ABSOLUTE FILL BANDS — A SECOND QUESTION, NOT A SECOND RAMP ════
 *
 * Owner ruling, 2026-08-31: *"the context figure becomes TWO fields, not one."*
 *
 * `occupancyLevel` above answers ONE question — how close is the handover ask —
 * and it answers it in the threshold's own units, so it moves when the
 * threshold moves. That is right for the ask and wrong for the window: how FULL
 * a context window is does not become a different fact because somebody
 * reconfigured when the handover fires.
 *
 * So the two questions are drawn as two fields:
 *
 *   ABSOLUTE FILL         ok  < 60      warn  60–85      crit  >= 85
 *                         Fixed. Never derived from the threshold.
 *   HANDOVER PROXIMITY    silent below T * 0.9, then one GOLD marker at two
 *                         weights. `occupancyLevel` decides WHEN it fires; the
 *                         presentation is a flag rather than a ramp.
 *
 * **The pair is the point, and it is why one ramp could not do this.** Red at
 * 91% with no gold beside it says the window is nearly full and the ask has not
 * fired. Red AND gold says both. A single three-step ramp collapses those two
 * readings into one colour and the reader cannot tell them apart — which is
 * what it had been doing.
 *
 * **Gold, and not a sixth hue.**
 * `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` assigns all
 * five meaning-hues; two full ramps would need a sixth and a seventh. Gold
 * already means "this wants your attention" in this product, and the handover
 * ask is exactly that — a REQUEST, not a severity level.
 *
 * **DECLARED ONCE, HERE, AND RESTATED BY NAME ELSEWHERE.** 60 and 85 are new
 * constants and a second copy of either is the defect this project has measured
 * eight times, so they are exported under names another surface can restate the
 * way `lib/live-invalidation.js` restates `STREAM_POLL_MS` and this file
 * restates `CONTEXT_SAMPLE_FRESH_MS`. `test/ui/viewmodel.test.ts` holds any such
 * restatement to these, so the mirror cannot rot in silence.
 */
export const CONTEXT_FILL_WARN_PERCENT = 60;
export const CONTEXT_FILL_CRIT_PERCENT = 85;

/**
 * The band an occupancy figure falls in on the ABSOLUTE scale — `'ok'`,
 * `'warn'`, `'crit'` — or `'stale'` for a sample too old to be levelled, or
 * `null` when there is no percentage to level.
 *
 * No threshold argument, deliberately: that is the whole difference between
 * this and `occupancyLevel`. `ageMs` is the caller's and is treated exactly as
 * `occupancyLevel` treats it — a fossil is drawn without a level rather than in
 * a confident colour, and the two fields must go unplaced together or a reader
 * gets one live-looking answer beside one withheld one.
 *
 * `>=` on both boundaries, so a window sitting exactly on 85 is nearly full
 * rather than one step below it.
 */
export function fillLevel(pct, ageMs) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  if (typeof ageMs === 'number' && Number.isFinite(ageMs) && ageMs > CONTEXT_SAMPLE_FRESH_MS) {
    return 'stale';
  }
  if (pct >= CONTEXT_FILL_CRIT_PERCENT) return 'crit';
  if (pct >= CONTEXT_FILL_WARN_PERCENT) return 'warn';
  return 'ok';
}

/* ══ THE FOUR USED-OF-MAXIMUM LEVELS — ONE SCALE, BOTH SURFACES ════════════
 *
 * **LIFTED HERE FROM `cli/commands/statusline-powerline.ts` ON 2026-09-01**,
 * verbatim: the three constants and `usageLevelOf` are character-for-character
 * what that file carried for one phase, less four TypeScript annotations. The
 * terminal now reads them back through the `import()` bridge it already uses
 * for `fillLevel` and `occupancyLevel`, and its restatement is gone.
 *
 * ── THE RULING ─────────────────────────────────────────────────────────────
 *
 * Owner, 2026-09-01, after reviewing a published statusline generator: *"use
 * our data and its visual ideas, the colours for the levels the icons"*, and —
 * the half that is easy to under-read — *"use the same controls for every
 * field that displays amount used from maximum available for context,
 * handover, used 5h, used 7d etc"*. So this is not a context-bar feature. It
 * is a treatment applied to EVERY used-of-maximum field on either surface, and
 * the three-band ok/warn/crit split becomes FOUR:
 *
 *     safe       0-60    no icon    --ok      calm
 *     caution   60-70    warning    --gold    worth knowing
 *     warning   70-80    diamond    --warn    act soon
 *     critical    80+    skull      --crit    act now
 *
 * ── WHY IT SPENT A PHASE IN THE CLI, AND WHY THAT IS OVER ─────────────────
 *
 * It belonged here from the day it was written. It could not land here first,
 * because `fillLevel` answers `'ok' | 'warn' | 'crit' | 'stale' | null` and
 * three places in `app.js` gated on exactly those names: extending the shared
 * contract without its consumers would have sent the context figure and both
 * rate chips grey, and — worse — `fillChip`'s `else` branch would have
 * LABELLED a `caution` window "comfortable". Not a degradation; a false
 * verdict on a surface, produced by a change confined to this file.
 *
 * So the terminal took the four levels alone for one phase, under a tripwire
 * test that fails the moment this file declares any of these names. That test
 * is `test/cli/statusline-levels.test.ts` · `TRIPWIRE`, it has fired, and the
 * restatement it was guarding has been deleted. Nothing is duplicated now.
 *
 * ── AND `fillLevel` STAYS, WITH A JOB ─────────────────────────────────────
 *
 * `fillLevel` is not superseded by this and is not a second spelling of it.
 * It answers a different question — the three-band ABSOLUTE fill, on the
 * boundaries 60 and 85 — and it is what `ctxFigureLevel` and the `strip.fill*`
 * chip still use to say "filling up" / "nearly full" in WORDS. The four levels
 * are what a used-of-maximum FIGURE is banded by. Two questions, two
 * functions, and the caution boundary is deliberately the same number in both:
 * `test/ui/viewmodel.test.ts` pins `USAGE_CAUTION_PERCENT` equal to
 * `CONTEXT_FILL_WARN_PERCENT`, so the web's 60 moving drags the other with it
 * rather than parting from it in silence.
 *
 * `USAGE_CRITICAL_PERCENT` is 80 while `CONTEXT_FILL_CRIT_PERCENT` is 85 —
 * that boundary MOVED, by the owner's table, and 80-85 is `critical` on the
 * four-level scale where the three-band one calls it `crit` five points later.
 * Written down because a boundary that moves in silence is exactly what the
 * tripwire above existed to prevent.
 */
export const USAGE_CAUTION_PERCENT = 60;
export const USAGE_WARNING_PERCENT = 70;
export const USAGE_CRITICAL_PERCENT = 80;

/**
 * The band a used-of-maximum percentage falls in — pure, total, and the whole
 * of the ruling's arithmetic.
 *
 * `>=` on every boundary, so a figure sitting exactly on 80 is `critical`
 * rather than one step below it — the convention `fillLevel` already uses,
 * kept identical so a reader who has learned one has learned both.
 *
 * `null` when there is no percentage to band. NOT clamped at 100: a field can
 * genuinely exceed its maximum — a context percentage past the handover
 * threshold does — and it is still `critical` there. Clamping belongs to the
 * BAR, which has only ten cells, and never to the verdict.
 */
export function usageLevelOf(pct) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  if (pct >= USAGE_CRITICAL_PERCENT) return 'critical';
  if (pct >= USAGE_WARNING_PERCENT) return 'warning';
  if (pct >= USAGE_CAUTION_PERCENT) return 'caution';
  return 'safe';
}

/**
 * **THE BAR, AND THE ONE CONSTANT PAIR THAT CHOOSES ITS STYLE.**
 *
 * The owner named `▓▓▓░░░` and `■■■□□□` as styles they liked in the abstract,
 * then wrote `▰▰▰▰▰▱▱▱▱▱` twice in the reference they actually drew. The drawn
 * thing wins over the named thing: a style named in passing is a preference, a
 * style written into a mock-up twice is a specification.
 *
 * Ten cells, as every version of the reference shows. Shared with the terminal
 * so a bar means the same number of cells on both surfaces — the strip draws
 * it in a proportional font where the cells are not columns, but the FILLED
 * COUNT is the fact, and that has to agree.
 */
export const BAR_FILL = '▰';
export const BAR_EMPTY = '▱';
export const BAR_CELLS = 10;

/**
 * `pct` drawn as `BAR_CELLS` cells.
 *
 * CLAMPED at both ends, and this is the one place clamping is right: a field
 * past its maximum has no eleventh cell to fill and a negative percentage has
 * no cell to empty. The VERDICT is not clamped — `usageLevelOf` still answers
 * `critical` — and the NUMBER beside the bar is not clamped either, so nothing
 * about the fact is lost at the picture's edge.
 *
 * Rounded rather than floored: a floor draws an empty bar for everything under
 * 5%, and "almost none" and "none" are different facts. A non-finite figure
 * draws an EMPTY bar rather than an empty string, so a bar is always the same
 * width and two of them can be compared by eye.
 */
export function usageBar(pct) {
  const exact = typeof pct === 'number' && Number.isFinite(pct) ? (pct / 100) * BAR_CELLS : 0;
  const filled = Math.max(0, Math.min(BAR_CELLS, Math.round(exact)));
  return BAR_FILL.repeat(filled) + BAR_EMPTY.repeat(BAR_CELLS - filled);
}

/**
 * `549009` as `549.0k`, `1000000` as `1.0M` — the count ABBREVIATED.
 *
 * ── THE THIRD POSITION ON ONE QUESTION, AND THEY ALL HAD REASONS ──────────
 *
 * 1. Abbreviated (`tokenCount`'s `k`), because the strip was tight.
 * 2. **Full and comma-grouped**, 2026-09-01: the owner's reference line read
 *    `(90,000 / 200,000)`, and `648.3k` is a figure a reader cannot check
 *    against anything while `648,317` is what Claude Code itself reports.
 *    Width was not pressing at the time.
 * 3. **LIVE — abbreviated again**, later the same day: *"in order to shorten
 *    numbers you can change them to K and M"*.
 *
 * The reversal is coherent rather than a whim, and the reason is what changed
 * between (2) and (3): every field on the bar has just become a bordered pill
 * with its own padding, and abbreviation is the cheapest width to buy back.
 * The digits were the least informative place to spend it — a reader glancing
 * at a status bar is reading the BAR and the percentage, and the exact
 * hundreds of a token count is not what that glance is for.
 *
 * ── THE ROUNDING IS A CHOICE, SO IT IS STATED ────────────────────────────
 *
 * ONE DECIMAL on both k and M. `999400` renders `999.4k`, not `999k`, so the
 * abbreviation costs at most 50 tokens of displayed precision rather than the
 * 400 a whole-thousands form would. `1000000` renders `1.0M` and not `1000.0k`
 * — the unit changes at a million so the number stays under four digits.
 *
 * ONE FUNCTION FOR BOTH SURFACES. The terminal re-exports this rather than
 * spelling it again, so the two bars cannot punctuate one number two ways —
 * they were split on exactly this before phase 2 and it is not worth
 * re-splitting them to save a call.
 */
export function fmtCount(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '?';
  const abs = Math.abs(n);
  const body = abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1_000 ? `${(abs / 1_000).toFixed(1)}k` : String(Math.round(abs));
  return n < 0 ? `-${body}` : body;
}

/* ══ THE ACCOUNT'S TWO RATE-LIMIT WINDOWS ══════════════════════════════════
 *
 * Owner ruling, 2026-08-31. `rate_limits.five_hour` and `rate_limits.seven_day`
 * ride in the status-line payload the tee already stores WHOLE, so this needs
 * no new source and no new call — `core/statusline-tee.ts` reads them at the
 * same moment it reads the context window and `/api/watch/context` carries
 * both.
 *
 * **Possibly absent, at three levels, and each is silence rather than a
 * placeholder**: `rate_limits` is optional in the payload, either window inside
 * it can be missing on its own, and either field inside a window can be a shape
 * this code does not recognise. `STD-a-measured-zero-is-drawn-and-named` asks
 * for a measured zero to be DRAWN; a window the payload never mentioned is not
 * a measured zero, and inventing a `0%` for it would be a claim about an
 * account nobody made.
 */
export function rateWindows(body) {
  const r = body === null || body === undefined ? null : body.rateLimits;
  if (r === null || r === undefined || typeof r !== 'object') return { fiveHour: null, sevenDay: null };
  const one = (w) => {
    if (w === null || w === undefined || typeof w !== 'object') return null;
    if (typeof w.usedPercent !== 'number' || !Number.isFinite(w.usedPercent)) return null;
    return {
      usedPercent: w.usedPercent,
      // Unix SECONDS, and `null` when the payload did not carry one. The
      // countdown is what makes the figure actionable rather than merely
      // alarming, but a reset time nobody served is not one this page may
      // guess at.
      resetsAt: typeof w.resetsAt === 'number' && Number.isFinite(w.resetsAt) ? w.resetsAt : null,
    };
  };
  return { fiveHour: one(r.fiveHour), sevenDay: one(r.sevenDay) };
}

// The strip's decision table (spec §4b + §7): five states, each its own
// rendering, never a number invented for a state that lacks one. `age` is
// computed by the caller from receivedAt at render time so it ticks — it is
// deliberately NOT a field here, because a number frozen at fetch time is the
// one thing an "as of … ago" label must not be.
//
// **`handover` rides along, and it is the SERVER's** (`plan:walk seq:118`,
// `seq:117`). Both the verdict and the threshold are read off the body and
// neither is computed: `core/handover-ask.ts` owns the comparison and
// `core/config.ts` owns the threshold's default. A body from a build that
// predates the field lands on the same shape a feature-off corpus lands on,
// which is the honest reading — this page cannot tell those two apart and does
// not pretend to.
export function contextStrip(body, isCold) {
  const handover = handoverOf(isCold ? null : body);
  // The account's two windows ride the same body and are read here so every
  // caller gets one view object rather than reaching back into the response.
  // A cold session is a hypothetical and has no account reading either.
  const rate = rateWindows(isCold ? null : body);
  // ── AND THE SEVEN FACTS THE TERMINAL BAR HAS ALWAYS DRAWN AND THIS ONE
  // NEVER DID (2026-09-01). Read on the same body, in the same pass, so a
  // caller gets ONE view object — the reason `rate` is read here and not in
  // the DOM builder. `identityOf` reports every one of them as `null` for a
  // cold session, which is what a hypothetical has to say about a model, a
  // cost or a log it has no reading of.
  const identity = identityOf(isCold ? null : body);
  if (isCold || body === null) {
    return {
      state: 'cold', pct: null, used: null, size: null, receivedAt: null,
      myctx: null, myctxError: null, handover, rate, ...identity,
    };
  }
  const myctx = body.mycontext ?? null;
  const myctxError = body.mycontextError ?? null;
  if (body.sample === null) {
    return {
      state: 'no-bridge', pct: null, used: null, size: null, receivedAt: null,
      myctx, myctxError, handover, rate, ...identity,
    };
  }
  const c = body.sample.context;
  return {
    state: c.state,                    // 'known' | 'not-yet-known' | 'unknown'
    pct: c.percent,
    used: c.usedTokens,
    size: c.windowSize,
    receivedAt: body.sample.receivedAt,
    myctx,
    myctxError,
    handover,
    rate,
    ...identity,
  };
}

/**
 * **WHAT THE TERMINAL BAR DRAWS AND THIS STRIP DID NOT** — read off the served
 * body, defensively, and never derived here.
 *
 * Every one of these was already on `mycontext statusline` and on no web
 * surface at all. They diverged because each bar was specified separately with
 * nothing holding them together; `test/ui/strip-parity.test.ts` is what holds
 * them together now, and this is the client half of the fields it checks.
 *
 * **Not computed, in every case where computing was the tempting option.**
 * The non-default MODES are folded into one phrase by the server, because which
 * words count as "not the ordinary case" is a judgement about an external
 * payload rather than about a language. The CACHE SHARE is derived from the
 * three token counts by `payloadExtras`, beside the occupancy that divides the
 * same numerator — a browser repeating that division would be a second
 * spelling. The LOG's staleness is decided by `age > CONTEXT_SAMPLE_FRESH_MS`
 * at draw time, against this module's own constant, so no second boundary
 * exists to disagree with the one the context chip already uses.
 *
 * `null` throughout means NOT SERVED, which the caller draws as a named
 * unmeasured state and never as a zero.
 */
function identityOf(body) {
  const b = body === null || body === undefined || typeof body !== 'object' ? {} : body;
  const str = (v) => (typeof v === 'string' && v !== '' ? v : null);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const log = b.lastAudit === null || b.lastAudit === undefined
    || typeof b.lastAudit !== 'object' ? null : b.lastAudit;
  return {
    model: str(b.sample?.model),
    modes: str(b.modes),
    sessionName: str(b.sessionName),
    // `focus` is read from `state/focus.json` by the server and NOT from the
    // audit log: every `focus-set` row in the real log carries `sessionId:
    // null`, so the log cannot answer "what is this session focused on" at
    // all. That is measured, not assumed. `false` is the measured no-focus
    // state and `null` is "the server did not say" — two different sentences.
    focus: str(b.focus),
    focusRead: typeof b.focus === 'string' || b.focus === null,
    costUsd: num(b.costUsd),
    // `cost.total_duration_ms`, served since 2026-09-01 so the strip can draw
    // the ELAPSED field the terminal already drew — the one field that was
    // failing `terminal ⊆ web` on both the unit and the browser parity gates.
    elapsedMs: num(b.elapsedMs),
    warmPercent: num(b.warmPercent),
    lastAudit: log === null || typeof log.state !== 'string' ? null : {
      state: log.state,                  // 'known' | 'empty' | 'unreadable'
      op: str(log.op),
      at: str(log.at),
    },
  };
}

/**
 * The served handover block, read defensively and never re-derived.
 *
 * Every field is nullable and `verdict: null` is the one the caller draws
 * nothing for — an endpoint that did not answer, or a cold session with no
 * endpoint to ask. It is NOT `off`: "the feature is switched off" is a
 * measurement this page was told, and "nobody asked" is not.
 */
function handoverOf(body) {
  const h = body === null || body === undefined ? null : body.handover;
  if (h === null || h === undefined || typeof h !== 'object') {
    return { verdict: null, path: null, askedAt: null, writtenAt: null, threshold: null };
  }
  return {
    verdict: typeof h.verdict === 'string' ? h.verdict : null,
    path: h.path ?? null,
    askedAt: h.askedAt ?? null,
    writtenAt: h.writtenAt ?? null,
    threshold: typeof h.thresholdPercent === 'number' ? h.thresholdPercent : null,
  };
}

/* ══ THE CORPUS DRIFT CHIP ══════════════════════════════════════
 *
 * `measureCorpusDrift` landed on 2026-08-31 and `/api/ping` and `/api/meta`
 * both serve its answer as `corpus`. Nothing drew it, and its six string keys
 * were already sitting in both tables. This is the decision table for the three
 * states its own `drifted: boolean | null` names, written here rather than as a
 * branch inside a DOM builder so a unit test can reach every one of them.
 *
 * **`false` is a MEASUREMENT and `null` is not.** `core/corpus-drift.ts` is
 * explicit: a truncated sweep that found nothing answers `null` rather than
 * `false`, because "nothing here" over the part that fit is not the question
 * that was asked. A surface drawing this must say "not known" and never "no"
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`).
 */
export function corpusDrift(corpus) {
  if (corpus === null || corpus === undefined || typeof corpus !== 'object') {
    return { state: 'unknown', aheadByMs: null };
  }
  if (corpus.drifted === true) {
    return {
      state: 'drifted',
      aheadByMs: typeof corpus.aheadByMs === 'number' ? corpus.aheadByMs : null,
    };
  }
  if (corpus.drifted === false) return { state: 'in-step', aheadByMs: null };
  return { state: 'unknown', aheadByMs: null };
}

// One series from the volume endpoint's columns: the HEIGHT only. The
// per-kind breakdown each bucket also carries is the pulse's colouring, and
// the pulse is not drawn by this plan yet (§0, open question 1) — the six
// kinds have no clean mapping onto the approved palette and that is an open
// owner decision, so nothing here names a colour.
//
// `Math.max(1, …)` is the empty-window case and not a nicety: a window in
// which nothing happened must draw a flat line on the floor, and 0/0 would
// draw NaN into the `points` attribute instead.
export function sparkline(buckets, width, height) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const step = buckets.length > 1 ? width / (buckets.length - 1) : 0;
  return buckets
    .map((b, i) => `${Math.round(i * step)},${Math.round(height - (b.total / max) * height)}`)
    .join(' ');
}

/** Which string key each stream event renders as; `record` renders as a row. */
const STREAM_EVENT_KEYS = {
  hello: 'watch.streamWaiting',
  record: null,
  resync: 'watch.resync',
  fault: 'watch.streamFault',
};

// **`resync` is an event, not a silence, and this is where it becomes an
// obligation.** `AuditTail.poll()` answers `{ records: [], resync: true }` when
// the log diverged under it — a known segment that shrank or vanished, or an
// unknown segment that is not the live log, which is the face a rotation
// actually shows (it recreates `audit.jsonl` at the same path, at a size that
// need not be smaller, so nothing shrinks). The tail resets to the current
// EOFs rather than replaying, so whatever landed in the gap is NOT coming down
// this stream (`ui/watch-model.ts` · `if (result.resync) sseSend(res, 'resync', {});` · ~462).
//
// The only way to fill that hole is to refetch the backlog through the query
// surface, which reads the projection and is immune to the rename — so
// `refetchBacklog` is that obligation, written where a test can reach it
// rather than as one branch of a DOM switch that nothing checks. A screen that
// renders the record events and ignores the resync shows a gap as if nothing
// had happened, which is the one thing an audit view may not do.
//
// An event this build does not know is `'unknown'` and carries no record: a
// frame the parser could read but this function cannot name must not reach the
// feed as though it were audited history.
export function describeStreamEvent(event, data) {
  const known = Object.hasOwn(STREAM_EVENT_KEYS, event);
  const payload = data !== null && typeof data === 'object' ? data : {};
  return {
    kind: known ? event : 'unknown',
    pollMs: event === 'hello' && typeof payload.pollMs === 'number' ? payload.pollMs : null,
    record: event === 'record' ? (data ?? null) : null,
    gap: event === 'resync',
    refetchBacklog: event === 'resync',
    // The server ends the response after a fault and nothing reconnects
    // (spec §2), so this is the last event a screen will see on this stream.
    ended: event === 'fault',
    error: event === 'fault' && typeof payload.error === 'string' ? payload.error : null,
    stringKey: known ? STREAM_EVENT_KEYS[event] : null,
  };
}

// --- The nav.inj screens' view-models (web-ui plan 1, Task 17) --------------

// The shared grammar of `/api/select`, `/api/render` and `/api/simulate`,
// built in ONE place because all three nav.inj screens send it and the server
// parses it in one place too
// (`ui/read-model.ts` · `export function parseSelectQuery(` · ~232).
//
// **`cold` is labelled by construction, not by remembering.** The endpoint
// refuses a request carrying both `session` and `cold`, and refuses one
// carrying neither — so a screen that forgot which question it was asking gets
// a 400 rather than an answer about the wrong session. Passing the literal
// `'cold'` through this function is how a caller says "a brand-new session's
// answer" without a second spelling of `cold=1` on every screen.
//
// **`path` is omitted rather than sent empty** for the three events that take
// none: `/api/select` refuses `path` on anything but `event=tool`, because
// "this endpoint refuses what it would ignore". `null` and `undefined` are
// both the absence — a caller reading a picker that has no selection yet
// hands over `null`, and a caller that never had a picker omits the argument.
export function selectQuery(event, path, session, extra = {}) {
  const qs = new URLSearchParams();
  qs.set('event', event);
  if (path !== null && path !== undefined) qs.set('path', path);
  if (session === 'cold') qs.set('cold', '1');
  else qs.set('session', session);
  for (const [key, value] of Object.entries(extra)) qs.set(key, String(value));
  return qs.toString();
}

// A budget's fill, as a percentage and an overflow flag.
//
// **A budget of zero is not a division, and `over` still has to be right.**
// `0/0` is NaN, which draws an unparsable width; and a tier budgeted at zero
// that was nonetheless charged something is over its budget, which is a fact
// worth keeping rather than rounding to a tidy `{ pct: 0, over: false }`.
// Both directions are pinned by the test.
//
// The percentage is CLAMPED at 100 rather than allowed to run past it: an
// over-budget selection is disclosed by `over`, and a bar drawn at 140% would
// overflow its own track and say the same thing twice, one of them wrongly.
export function budgetBar(used, budget) {
  if (budget <= 0) return { pct: 0, over: used > 0 };
  return { pct: Math.min(100, Math.round((used / budget) * 100)), over: used > budget };
}

// --- The coverage tree, the gap list and the ego layout (web-ui plan 1, Task 18)

/**
 * Every walked path as a tree, with governance aggregated up the directories.
 *
 * `/api/coverage` answers a FLAT list — one entry per walked file, carrying the
 * ids that govern it — because the rule that produced it (`injection()` then
 * `matchesScope`) is per file and per item. The screen draws a tree, and the
 * roll-up is the whole of the difference between the two: a directory's
 * `fileCount` is every file beneath it, its `governedCount` is how many of
 * those any item governs, and its `governs` is the UNION of its files', so the
 * count on a row and the list in the detail pane are the same fact twice.
 *
 * **The union, never a re-match.** This function never asks whether an item
 * governs a directory — no glob is evaluated here and none may be. `select.ts`
 * is where `matchesScope` lives and the server is where it ran; a second
 * matcher in the browser is the defect `/api/coverage`'s own docblock names by
 * name (`ui/read-model.ts` · `never `matchesAnyGlob`. An empty scope` · ~1109).
 *
 * Children sort DIRECTORIES BEFORE FILES, then by name, which is the mockup's
 * own tree order (`src/`, `src/billing/`, `src/billing/prices.js`, `src/api/`,
 * ... — every directory's own subtree drawn before the next sibling). The order
 * is part of the answer: two runs over one corpus draw the same rows.
 */
export function buildTree(files) {
  const root = { name: '', path: '', children: [], governs: [], fileCount: 0, governedCount: 0 };
  const dirs = new Map([['', root]]);
  const ensureDir = (dirPath) => {
    const existing = dirs.get(dirPath);
    if (existing !== undefined) return existing;
    const cut = dirPath.lastIndexOf('/');
    const parent = ensureDir(cut === -1 ? '' : dirPath.slice(0, cut));
    const node = {
      name: cut === -1 ? dirPath : dirPath.slice(cut + 1),
      path: dirPath,
      children: [], governs: [], fileCount: 0, governedCount: 0,
    };
    parent.children.push(node);
    dirs.set(dirPath, node);
    return node;
  };

  for (const file of files) {
    const cut = file.path.lastIndexOf('/');
    const dirPath = cut === -1 ? '' : file.path.slice(0, cut);
    const dir = ensureDir(dirPath);
    const governs = [...new Set(file.governs)].sort();
    const leaf = {
      name: cut === -1 ? file.path : file.path.slice(cut + 1),
      path: file.path,
      children: [],
      governs,
      fileCount: 1,
      governedCount: governs.length > 0 ? 1 : 0,
    };
    dir.children.push(leaf);
    // Up to the root INCLUSIVE, one ancestor at a time. The plan's own sketch
    // walked with a ternary chain inside the `for`'s update clause that could
    // not express "stop after the root", and its own note said the assertions
    // are the contract rather than the loop. This is the loop that satisfies
    // them: every ancestor of the file's directory, the empty-path root last.
    for (let ancestor = dirPath; ; ) {
      const node = dirs.get(ancestor);
      node.fileCount += 1;
      node.governedCount += leaf.governedCount;
      for (const id of governs) if (!node.governs.includes(id)) node.governs.push(id);
      if (ancestor === '') break;
      const up = ancestor.lastIndexOf('/');
      ancestor = up === -1 ? '' : ancestor.slice(0, up);
    }
  }

  const sortRec = (node) => {
    node.children.sort((a, b) => {
      const aDir = a.children.length > 0;
      const bDir = b.children.length > 0;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    node.governs.sort();
    node.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

/**
 * The directories nothing scopes — `gaps.sub`'s "directories no item scopes".
 *
 * **The SHALLOWEST ungoverned directory is the name, and its subtree is not
 * repeated.** `src/workers/` with three ungoverned files beneath it is one gap,
 * not four: `cov.e2`'s rule for the empty state — "one sentence, said once —
 * not repeated per row" — is the same rule this list obeys, and a gaps table
 * that named every descendant of an ungoverned directory would bury the one
 * row a reader can act on.
 *
 * A FILE is never a gap here. The gaps table's first column is a `Where`, and
 * every ungoverned file already shows as a `.dot w` on the coverage tree; the
 * actionable unit is the directory a scope glob can be written for.
 */
export function coverageGaps(tree) {
  const gaps = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.children.length === 0) continue;
      if (child.governedCount === 0) { gaps.push(child.path); continue; }
      walk(child);
    }
  };
  walk(tree);
  return gaps.sort();
}

/**
 * The same gaps, each carrying the file count `gaps.r1` interpolates —
 * "{files} files, no item scopes here".
 *
 * A second function rather than a second shape from `coverageGaps`, because the
 * plan pins that one's `string[]` contract and a screen still needs the number
 * the sentence is about. Reading it off the tree in the DOM glue instead would
 * put the "which count goes in this sentence" decision on the untested side of
 * spec §6's line.
 */
export function coverageGapRows(tree) {
  const byPath = new Map();
  const index = (node) => { byPath.set(node.path, node); node.children.forEach(index); };
  index(tree);
  return coverageGaps(tree).map((gapPath) => ({
    path: gapPath,
    files: byPath.get(gapPath).fileCount,
  }));
}

/**
 * The tree flattened to the mockup's own drawing order — a FLAT list of rows,
 * each with the depth its `data-depth` step reads.
 *
 * The mockup draws the tree as sibling `<button role="treeitem">`s indented by
 * `data-depth` rather than as nested lists, "so it mirrors" (`cov.magn`), and
 * the root itself is never a row: its children start at depth 0, exactly as
 * `src/` and `vendor/` do there.
 */
export function treeRows(tree) {
  const rows = [];
  const walk = (node, depth) => {
    for (const child of node.children) {
      rows.push({ node: child, depth });
      walk(child, depth + 1);
    }
  };
  walk(tree, 0);
  return rows;
}

/**
 * Which of the mockup's four dots a row wears — `g` scoped, `o` one item, `w`
 * gap (`cov.k1`, `cov.k2`, `cov.k3`).
 *
 * **`n` — "not examined" (`cov.k4`) — is never returned, and that is a REFUSAL
 * rather than an oversight.** It is a third state about paths the walk did not
 * reach, and `/api/coverage` carries one global `truncated` boolean and no path
 * list at all; the read model records the gap in its own words
 * (`ui/read-model.ts` · `needs the paths `listRepoFiles` did not reach` · ~1074).
 * Every path this function is ever asked about came out of the walk, so it was
 * examined; returning `n` for one would be inventing the state `gaps.note` says
 * must never be folded into another.
 */
export function coverageDot(node) {
  if (node.governedCount === 0) return 'w';
  return node.governs.length === 1 ? 'o' : 'g';
}

/**
 * Whether the coverage screen draws `#covempty` — "Nothing governs this project
 * yet" (`cov.e1`).
 *
 * Both halves, because the pinned items are hoisted out of the per-path answer
 * and a corpus holding only pinned items governs every path in it. A repository
 * whose walk found no files at all is also this state and not an error.
 */
export function coverageIsEmpty(body) {
  return body.pinned.length === 0 && body.files.every((file) => file.governs.length === 0);
}

/**
 * The ego graph's layout — **columns by DIRECTION, which is what the mockup
 * draws and what `gr.note` says it means**: "Direction is the layout: the column
 * decides which way the relation points, so nothing has to be simulated."
 *
 * A node's column is its SIGNED BFS depth from the focus: negative on the side
 * that points AT the focus, positive on the side the focus points at, zero for
 * the focus itself. Those signed depths are then sorted and collapsed to
 * indices, so a graph with nothing pointing at its focus draws two columns
 * rather than reserving an empty one — and the focus lands at index 0 in
 * exactly that case, which is the plan's own pinned assertion.
 *
 * **Deterministic, and by the server's own ordering rule.** Neighbours are
 * sorted by relation type then id before the walk — the same comparison
 * `/api/graph` sorts its adjacency by — so the rows in a column come out in
 * (type, id) order, the same on every machine and on every call. No physics, no
 * simulation, no random seed: two runs over one corpus are the same pixels.
 *
 * A node named only by an edge and absent from `nodes` is not placed: the cap
 * drops nodes and keeps `omitted` as a count, so an edge can name an id this
 * response does not carry.
 */
export function layoutGraph(nodes, edges, focusId) {
  const present = new Set(nodes.map((node) => node.id));
  const adjacency = new Map();
  const add = (key, entry) => {
    const list = adjacency.get(key);
    if (list === undefined) adjacency.set(key, [entry]);
    else list.push(entry);
  };
  for (const edge of edges) {
    add(edge.from, { other: edge.to, type: edge.type, direction: 1 });
    add(edge.to, { other: edge.from, type: edge.type, direction: -1 });
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => (a.type === b.type
      ? (a.other < b.other ? -1 : a.other > b.other ? 1 : 0)
      : (a.type < b.type ? -1 : 1)));
  }

  const signed = new Map([[focusId, 0]]);
  const order = [focusId];
  for (let i = 0; i < order.length; i++) {
    const base = signed.get(order[i]);
    for (const neighbour of adjacency.get(order[i]) ?? []) {
      if (signed.has(neighbour.other) || !present.has(neighbour.other)) continue;
      signed.set(neighbour.other, base === 0 ? neighbour.direction : base + Math.sign(base));
      order.push(neighbour.other);
    }
  }

  const columns = [...new Set(signed.values())].sort((a, b) => a - b);
  const index = new Map(columns.map((depth, i) => [depth, i]));
  const rows = new Map();
  return order.map((id) => {
    const depth = signed.get(id);
    const x = index.get(depth);
    const y = rows.get(x) ?? 0;
    rows.set(x, y + 1);
    return { id, x, y, depth };
  });
}

/**
 * Which line style an edge wears — the legend's three, and no fourth.
 *
 * `dangling` outranks `bearing` because a broken load-bearing relation is drawn
 * as broken: `gr.note` keeps the two facts apart on purpose — "a dangling
 * relates_to reads as noise and a dangling constrains reads as an alarm" — and
 * the alarm is the severity the dashed `--crit` line carries. The
 * classification itself is the SERVER's: `loadBearing` is `isLoadBearing(type)`
 * called in `/api/graph`, never a vocabulary re-listed in the browser.
 */
export function edgeClass(edge) {
  if (edge.dangling) return 'dangling';
  return edge.loadBearing ? 'bearing' : 'ref';
}

/**
 * Which node style a node wears — `focus`, `missing`, `superseded`, or none.
 *
 * The three the legend names (`gr.lfocus`, `gr.lmiss`, `gr.lsup`), read off the
 * response's own fields rather than derived: `focus` is the body's `focus`,
 * `missing` is the node's, and superseded is `status`.
 */
export function egoNodeClass(node, focusId) {
  if (node.id === focusId) return 'focus';
  if (node.missing) return 'missing';
  return node.status === 'superseded' ? 'superseded' : '';
}

/**
 * `runChecks`' three levels, in the order `doctor` reports them and the order
 * the mockup stacks its three cards in: error, then warning, then notice.
 * A level this build does not know sorts LAST rather than to `NaN` — the
 * browser has no types, and `LEVEL_ORDER[level] - LEVEL_ORDER[other]` on an
 * unknown string is a comparator that reports "equal" for every pair and
 * silently unsorts the whole list.
 */
const LEVEL_ORDER = { error: 0, warn: 1, info: 2 };

const levelRank = (level) => (Object.hasOwn(LEVEL_ORDER, level) ? LEVEL_ORDER[level] : 3);


/**
 * Findings grouped by `code`, worst-first.
 *
 * Two orderings, and they answer two different questions. INSIDE a group the
 * levels sort error → warn → info, because one code can be reported at more
 * than one level and the reader wants the worst instance of it first. BETWEEN
 * groups the key is the group's OWN worst level, ties broken by code, so the
 * whole screen reads worst-first and reads the same way twice — `runChecks`
 * returns findings in check-registration order, which is an implementation
 * detail of the checker and not an order anyone should read meaning into.
 *
 * The sort inside a group is stable (ECMA-262 requires it), so two findings
 * with the same code AND the same level keep the order `runChecks` produced
 * them in — which is the order the files were walked, and the only order this
 * function has any right to preserve.
 *
 * Nothing is filtered. `/api/doctor` serves `runChecks` verbatim for the
 * reason its own docstring gives — *"a finding dropped between the checker and
 * the screen is undetectable from the screen"* — and a view-model that dropped
 * one here would undo that one layer further along.
 */
export function groupFindings(findings) {
  const groups = new Map();
  for (const finding of findings) {
    if (!groups.has(finding.code)) groups.set(finding.code, []);
    groups.get(finding.code).push(finding);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => levelRank(a.level) - levelRank(b.level));
  }
  const worst = (list) => Math.min(...list.map((f) => levelRank(f.level)));
  return new Map([...groups.entries()].sort((a, b) => (
    worst(a[1]) - worst(b[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
  )));
}

/**
 * The repair command for a finding code — **composed, never run** (spec §4),
 * and composed only where the finding's OWN MESSAGE names a command.
 *
 * This mapping was established by reading every message in
 * `src/doctor/checks.ts` and then reading the usage banner of every command
 * those messages name. The plan's own table
 * (`docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` · `others → null); establish the exact command per code by reading` · ~6449)
 * says in the same breath that it is a sketch and that the messages win. They
 * disagree with it on four rows, and the messages won every one:
 *
 *  - **`index_missing` → nothing.** The plan sends it to `mycontext rebuild`.
 *    Its message is *"It is disposable and will be built on the next
 *    command."* — a finding that explicitly asks for no action. A Copy button
 *    under it would invent work the checker went out of its way not to ask for.
 *  - **`orphan_relation` → nothing.** The plan sends it to `mycontext repair
 *    <id>`. The message says *"Create it, or remove the line from
 *    &lt;filePath&gt;"* — a file edit, and neither half is a command.
 *  - **`source_missing` → nothing.** The plan sends it to `mycontext repair
 *    <id>`; the message says *"retire &lt;id&gt; with `mycontext supersede`"*.
 *    But `supersede` REQUIRES a replacement
 *    (`cli/commands/supersede.ts` · `usage: mycontext supersede <retired id> --by <replacement id>` · ~29),
 *    and this screen has no replacement id to put there. A command line that
 *    cannot be pasted without editing is not a composed command; it is a
 *    placeholder wearing one's clothes.
 *  - **`mycontext repair` takes no id at all** — `usage: mycontext repair
 *    [--yes]` (`cli/commands/repair.ts` · `const USAGE = 'usage: mycontext repair [--yes]';` · ~10).
 *    Every row the plan routed through `mycontext repair <id>` would have
 *    composed a command the CLI refuses.
 *
 * What remains is the four codes whose message names a runnable command, and
 * each composed string is that message's own recommendation:
 *
 *  - `index_stale` → *"Run `mycontext rebuild`."*
 *  - `source_drift` → *"run `mycontext refresh <id>`"* — the same command the
 *    mockup composes under its own error card.
 *  - `audit_log_size` → *"See `mycontext audit --files`."*
 *  - `corpus_size_fallback_ceiling` → *"`mycontext decay` is the lever for
 *    retiring unused items"*.
 *
 * `null` for everything else, and `null` is the ordinary answer rather than
 * the exception: most findings are repaired by editing a file, and a screen
 * that offered a command for each of them would be composing fiction.
 *
 * The one argument any of these takes is quoted through `composeCommand`, the
 * single place quoting lives in this UI — so a hypothetical id carrying a
 * space or a quote is escaped here rather than in a fourth spelling.
 */
export function repairCommandFor(code, item) {
  if (code === 'index_stale') return composeCommand(['mycontext', 'rebuild']);
  if (code === 'audit_log_size') return composeCommand(['mycontext', 'audit', '--files']);
  if (code === 'corpus_size_fallback_ceiling') return composeCommand(['mycontext', 'decay']);
  if (code === 'source_drift' && typeof item === 'string' && item !== '') {
    // **`--yes`, which the doctor message's own recommendation does not carry.**
    //
    // Every other line here is that message's recommendation verbatim, and this
    // one is deliberately one flag longer. `refresh` replaces an item's whole
    // body, so it gates on a human by reading stdin — fine for the reader the
    // message was written for, who is standing at a terminal, and impossible for
    // this UI, which runs it as a child with no terminal. Owner-reported
    // 2026-08-28: it computed the change, printed it, and refused, and the dry
    // run behind the confirm refused first, so no confirm rendered either.
    //
    // The flag goes in the DISPLAYED line and not only in the executed argv,
    // because the invariant this whole feature rests on is that the string a
    // person reads is the argv that runs. A card showing `mycontext refresh X`
    // beside a button running `mycontext refresh X --yes` would be the exact
    // defect the confirm exists to prevent, wearing a tidier shape.
    //
    // The cost, stated: a reader who COPIES this line into their own terminal
    // gets no prompt. That is the catalogue's standing rule working as intended
    // — on the approval boundary `--yes` is SHOWN, never implied — and shown is
    // what it now is, in the card, in the clipboard and in the confirm alike.
    return composeCommand(['mycontext', 'refresh', item, '--yes']);
  }
  return null;
}

/**
 * **How many findings there are, and how many of them a command can repair.**
 *
 * `null` above is the ORDINARY answer — most findings are repaired by editing a
 * file, and the docstring says so — but until 2026-08-29 nothing on the screen
 * counted them, so a corpus in which every finding was of that ordinary kind
 * drew no repair control anywhere and said nothing about why. Owner, 2026-08-28:
 * *"doctor lost it's execute an fix controls ? why yo broke it ?"* Nothing had
 * broken. Nine `source_file` links had been cleared, which retired every
 * `source_drift`, and `blocked_without_needs` had landed — a finding whose
 * remedy is a PERSON naming a blocker, correctly not automatable. The corpus got
 * healthier and the toolbar went quiet, and quiet is what broken looks like.
 *
 * A number is what makes the two states tell themselves apart. "2 findings, 0
 * with an automated repair" is a sentence a reader can act on; an empty toolbar
 * is a sentence about the reader's own build.
 *
 * **It counts FINDINGS, not composed lines, and the difference is deliberate.**
 * `screens/doctor.js`' `cardCommands` dedupes by the composed line, because two
 * rows sharing a code share one `.cmd` block — that is a count of CONTROLS. This
 * is a count of the rows those controls answer for, which is the number the
 * sentence beside it ("N findings") is a fraction of. Counting deduped lines
 * here would produce "4 findings, 1 with an automated repair" over four
 * `index_stale` rows that every one of them repairs.
 *
 * It reads `repairCommandFor` rather than a second table, so the tally and the
 * per-row disclosure can never disagree about a code:
 * `test/ui/doctor-screen.test.ts` already holds that function and the screen's
 * own `repairFor` equal code by code.
 *
 * The keys are the SLOT NAMES `doc.tally` substitutes, so no third spelling of
 * "findings" exists to drift. The call site still writes the two out as a literal
 * rather than spreading this object — see its own comment: the scan that proves
 * every declared slot is supplied reads the argument literal, and a spread is
 * invisible to it.
 */
export function repairTally(findings) {
  let repairs = 0;
  for (const finding of findings) {
    if (repairCommandFor(finding.code, finding.item ?? null) !== null) repairs += 1;
  }
  return { findings: findings.length, repairs };
}

// --- The write preview, lifted out of one screen ----------------------------
//
// **`fieldView` was declared by `plan:ui2 seq:11` as `writeBlock` and never
// produced under any name.** `plan:ui2 seq:12` and `seq:13` both name it in
// their Interfaces as something they CONSUME, and a repo-wide search for
// `writeBlock` returned nothing (`plan:walk seq:46`). What existed instead was
// this — the same computation, correct and tested, trapped inside `work.js`
// where only the Review queue could reach it.
//
// It moves HERE rather than to `screens/parts.js` because it is a DECISION, not
// DOM: it takes a served field and returns a plain view model, which is exactly
// what this module is for and why `node --test` can import it directly.
//
// Promoted under its own name rather than renamed to `writeBlock`: the thing
// already exists and already has a tested name, so two plan edits cost less
// than a new vocabulary for one function.
//
// `DEC-the-web-ui-executes-a-composed-command-and-the-residual-is` is why this
// could not wait: a boundary-crossing command's confirm must name every field
// that changes, before and after, and the design names THIS function as how it
// is rendered. Configure needs it too. Building it twice was the outcome to
// avoid.

/**
 * The fields the mockup draws in a `.m` cell rather than as prose.
 *
 * It draws four rows and splits them: `title` takes a bare `<td>` wrapping a
 * `<bdi>`, while `tags` and `severity` take `<td class="m">`
 * (`docs/design/web-ui-mockup.html` · `<tr><td class="m">tags</td><td class="m">pii</td><td class="m">pii<ins>, gdpr</ins></td></tr>` · ~1938).
 * The split is prose versus token: a title and a body are sentences a human
 * wrote and reads in the page's own direction, while a tag list and an `extra`
 * key are keys and values with a direction of their own — which is what `.m`
 * (`direction:ltr; unicode-bidi:isolate`) exists for.
 *
 * `severity` is the mockup's third row and is **not a revision field**:
 * `REVISION_FIELDS` is `title`, `body`, `tags`, `extra`
 * (`src/core/revision-log.ts` · `export const REVISION_FIELDS = ['title', 'body', 'tags', 'extra'] as const;` · ~291),
 * so no `/api/revisions` answer can ever produce that row. The mockup's sample
 * is ahead of the log's vocabulary; reported, not reconciled here. `extra` is
 * classified with `tags` because `valueLines` renders it as `key: value` lines
 * (`src/core/revision-diff.ts` · `is ONE LINE PER KEY, sorted by key, for the same reason and one` · ~68).
 */
export const MONO_FIELDS = new Set(['tags', 'extra']);

/**
 * One served field-diff, as the two columns the table draws it in.
 *
 * **The `In force` column is the diff with its additions removed**, not a
 * second field the endpoint sends: there is no "current text" in the response
 * beyond what the diff itself carries, and re-deriving one would be a second
 * opinion about the same bytes. A `-` line and a ` ` context line are both
 * text that is in force today; a `+` line is text that is not.
 *
 * **The `Proposed` column is the whole diff**, context included, which is why
 * the mockup can draw `<del>advisory</del><ins>hard</ins>` inside one cell
 * (`docs/design/web-ui-mockup.html` · `<td class="m"><del>advisory</del><ins>hard</ins></td></tr>` · ~1940).
 * Both marks live in the proposed cell; the in-force cell is plain text. That
 * asymmetry is the mockup's, transcribed rather than tidied.
 *
 * `noCurrent` is the server's own word for "there is nothing to diff against"
 * — the item is gone, or the proposal names an `extra` key the item never had
 * (`src/ui/read-model-work.ts` · `// No current text to diff against (item missing, or an extra key the` · ~63).
 * There is no `work.noCurrent` in either table, so nothing is worded for it:
 * the cell takes the em dash this design already uses for "no value here", the
 * same mark `status.js` draws for a count nobody measured and `doctor.js` for
 * a finding that names no item.
 */
export function fieldView(field) {
  const diff = Array.isArray(field.diff) ? field.diff : [];
  return {
    field: field.field,
    stale: field.changed === true,
    mono: MONO_FIELDS.has(field.field),
    noCurrent: field.noCurrent === true,
    current: diff.filter((line) => line.mark !== '+').map((line) => line.text),
    proposed: diff.map((line) => ({ mark: line.mark, text: line.text })),
  };
}
