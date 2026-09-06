import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { UnmeasurableWhy } from '../../core/context-occupancy.ts';
import {
  distinctSessionName, modeFlags,
  type ModelModes, type RateLimit,
} from '../../core/statusline-tee.ts';
import type { CorpusResolution } from '../../core/corpus-identity.ts';
// The verdict UNION only, and a `type` import so nothing of the latch's
// machinery is dragged onto this per-message path: `core/handover-ask.ts`
// decides what became of an ask and this file renders the answer.
import type { HandoverAskVerdict } from '../../core/handover-ask.ts';
import { DIR_NAME } from '../../core/workspace.ts';

// --- The status line, as powerline blocks -----------------------------------
//
// Owner ruling: three layouts were reviewed and this one chosen — solid colour
// blocks with arrow separators, where the CONTEXT block is the one that changes
// colour, so the right end of the bar shifts as the window fills.
//
//     ▐ Opus 5 ▶ test_mycontext_plugin ▶ campaign/my-context-test ▶ ctx 42.0% ▌
//       (▶ stands in for the real separator, U+E0B0 — see `SEP`)
//         blue          dark grey                grey                GREEN
//
// Three rules shape everything below, and each of them ruled out an easier
// version:
//
//  1. THE BANDS ARE DERIVED, NEVER CHOSEN. `ok`/`warn`/`crit`/`stale` come out
//     of `src/ui/public/lib/viewmodel.js` — the same `occupancyLevel` the web
//     strip bands its chip with — and no threshold is spelled in this file.
//     See `LEVEL_SOURCE` for how a typed CLI module reaches an untyped browser
//     one, and why a second copy of `98` and `0.9` here would be this
//     project's single most repeated defect rather than a shortcut.
//  2. COLOUR IS NEVER THE ONLY CARRIER. Every block is a WORD and a number as
//     well as a hue: `ctx 93.4%`, `ctx — stale`, `ctx — no bridge`. That is
//     `src/ui/public/06-a11y.html`'s rule ("a glyph AND a colour AND a name"),
//     and it is also what makes `renderPowerline({ colour: false })` a real
//     degradation rather than an unreadable one.
//  3. NOTHING IS DROPPED SILENTLY. A block removed to fit a narrow terminal
//     leaves an `…` behind (`ELLIPSIS_SEGMENT`), an elided branch keeps its
//     leading `…`, and the ctx block is never the one that goes.
//     `INV-nothing-is-dropped-silently`, on the one surface whose entire job
//     is disclosure.

/**
 * **THE FIELD SEPARATOR — `│`, U+2502, and the whole of the frame.**
 *
 * ── THE POWERLINE PRESENTATION IS GONE, 2026-09-01 ────────────────────────
 *
 * Owner: *"terminal statusline is still not what i requested, it has the old
 * powerline design, also i wanted to use `▰▰▰▰▰▱▱▱▱▱ 45% (90,000 / 200,000)`
 * and not as you implemented"*, against this reference:
 *
 *     Sonnet 4.5 │ my-project ▰▰▰▰▰▱▱▱▱▱ 45% (90,000 / 200,000) │ 1h 24m
 *
 * There is no powerline in it. So the end caps (U+2590 / U+258C), the filled
 * arrow (U+E0B0), the outline chevron (U+E0B1) and every background fill are
 * removed, and what is left is flat text with this glyph between fields.
 *
 * **What that buys, beyond matching the reference.** The old frame needed a
 * Nerd Font for two private-use glyphs and a 256-colour terminal for the
 * backgrounds; this needs neither. U+2502 is ordinary box-drawing, present in
 * every font that draws a table, and the colour is now foreground ink on the
 * text — which is what a terminal with no colour at all degrades to gracefully
 * rather than losing a block's boundary with it.
 *
 * **One glyph, not two.** The owner's reference uses `│` between the model and
 * the project and an ASCII `|` before the elapsed time. Two characters that
 * differ by a hair in most fonts, in one line, is not a design — it is a
 * keystroke, and rendering it faithfully would put a visible inconsistency on
 * every bar forever. `│` throughout; flagged in the lane report so the owner
 * can overrule it with a word if the distinction was meant.
 */
export const FIELD_SEP = '│';

/**
 * **EVERY FIELD'S NAME, IN ONE TABLE — owner ruling, 2026-09-01.**
 *
 * *"i want a field name on the left of every info because it's not self
 * explanatory"*, and then *"caps as name looks ok, use for both"*.
 *
 * **These are the web strip's own `strip.grp.*` names**, upper-cased the way
 * the strip already renders them, so the two surfaces cannot drift on what a
 * field is CALLED or on how it is written. Keyed by the parity `field` id, so
 * a field added to the bar without a name here is a field the reader has to
 * recognise — which is the complaint this table answers.
 *
 * Where a group holds ONE field the group's name is used (`MODEL`, `REPO`,
 * `COST`, `AUDIT`, `SESSION`). Where it holds several, each field keeps its
 * own (`ASK` and `WINDOW` inside the strip's `window` group; `7D` and `5H`
 * inside `limits`) — a group name repeated on two fields would name neither.
 * `BRANCH`, `FOCUS` and `ELAPSED` have no web counterpart and are named in
 * the same register rather than in a second vocabulary.
 */
export const FIELD_NAME: Record<string, string> = {
  model: 'MODEL',
  project: 'REPO',
  branch: 'BRANCH',
  'session-name': 'SESSION',
  focus: 'FOCUS',
  ask: 'ASK',
  /**
   * **WHAT BECAME OF THE ASK, as against how far it is** — `plan:handover
   * seq:13`. `ASK` is the measurement and this is the verdict on the document
   * the measurement is about, which is the same division the strip has drawn
   * since `plan:walk seq:118`: `data-f="ask"` is a bar, `data-f="handover-
   * verdict"` is a sentence about the file.
   *
   * Named for the FILE and not for the ask, because the two blocks would
   * otherwise both be called ASK and neither would be named.
   */
  'handover-verdict': 'HANDOVER',
  context: 'WINDOW',
  'rate-7d': '7D',
  'rate-5h': '5H',
  myctx: 'MYCTX',
  'cost-cache': 'COST',
  'last-audit': 'AUDIT',
  elapsed: 'ELAPSED',
  // The three the owner asked for on 2026-09-02. `CWD` and `CLOCK` have no
  // web counterpart to borrow a name from and are named in the same register;
  // `CORPUS` is the strip's own `strip.grp.corpus`, and the strip's new field
  // takes the same word so the two surfaces cannot drift on what it is called.
  cwd: 'CWD',
  'corpus-root': 'CORPUS',
  clock: 'CLOCK',
};

/** The separator with its spaces, which is how it is actually joined. */
export const FIELD_JOIN = ` ${FIELD_SEP} `;

/**
 * **WHERE THE BANDS COME FROM, AND WHY THE IMPORT LOOKS LIKE THIS.**
 *
 * `occupancyBands(threshold)` and `occupancyLevel(pct, threshold, ageMs)` live
 * in `src/ui/public/lib/viewmodel.js`, together with the derivation that
 * produced them (`OCCUPANCY_WARN_FRACTION`, and the two auto-compaction records
 * it was measured against) and `CONTEXT_SAMPLE_FRESH_MS`. The web strip bands
 * its chip with exactly these. Restating `0.9` and `15 * 60_000` here would put
 * the terminal and the browser one edit away from telling the same reader two
 * different verdicts about the same number.
 *
 * That module is a plain browser ES module: deliberately untyped, deliberately
 * outside `tsconfig.json`'s `include`, so the browser and `node --test` load
 * the same bytes with no build step. A STATIC `import` of it from a
 * type-checked `.ts` file does not compile — with `allowJs` off it is TS7016,
 * and `npx tsc --noEmit` is a gate. A URL specifier through `import()` is what
 * lets a TypeScript file reach it, and it is also the only form that survives a
 * Windows path — the same mechanism, for the same two reasons, as
 * (`test/ui/viewmodel.test.ts` · `A URL specifier is what` · ~47).
 *
 * **Top-level `await`, not a lazy load.** `CommandFn` is synchronous
 * (`src/cli/commands/registry.ts` · `export type CommandFn` · ~6), so the level
 * lookup has to be synchronous at call time; resolving the module once while
 * this module is evaluated is the only way to have both. Measured cost: 1.2 ms
 * on this machine, paid once per CLI invocation, against a command that already
 * opens SQLite. Hooks do not pay it at all — `hooks/hooks.json` runs
 * `src/hooks/*.ts` directly and never loads the command registry.
 *
 * **`null` rather than a throw when it will not load**, and the caller then
 * draws the neutral block: a browser asset that has been moved or corrupted is
 * a reason to lose the COLOUR, never a reason to blank the user's status line
 * or to invent a band from remembered numbers.
 */
export const LEVEL_SOURCE = new URL('../../ui/public/lib/viewmodel.js', import.meta.url).href;

interface BandModule {
  /** How close the handover ask is — derived from the threshold. */
  occupancyBands: (threshold: unknown) => { warn: number; crit: number } | null;
  occupancyLevel: (pct: unknown, threshold: unknown, ageMs: unknown) => string | null;
  OCCUPANCY_WARN_FRACTION: number;
  /** How full the window is — absolute, and never derived from the threshold. */
  fillLevel: (pct: unknown, ageMs: unknown) => string | null;
  /** How far the ask is, in points of the window — `threshold - pct`. */
  askHeadroom: (pct: unknown, threshold: unknown) => number | null;
  /**
   * **The four `plan:handover seq:13` derivations**, and they come across this
   * bridge for the reason every other number here does: the strip draws the
   * same percent pair beside the same words, and an arithmetic written twice
   * is how two surfaces come to disagree about one handover.
   *
   * `askStepOf` is the browser's twin of `core/handover-ask.ts`'s `askStep`
   * and is pinned against it by test; the terminal takes it from HERE rather
   * than importing the core one, so that whichever number the strip draws is
   * the number this bar draws.
   */
  askStepOf: (pct: unknown) => number | null;
  asksLeft: (pct: unknown) => number | null;
  handoverLag: (askedAtPercent: unknown, pct: unknown) => number | null;
  askSeries: (pct: unknown, threshold: unknown) => {
    span: number; spent: number; percent: number; toFull: number;
  } | null;
  CONTEXT_FILL_WARN_PERCENT: number;
  CONTEXT_FILL_CRIT_PERCENT: number;
  CONTEXT_SAMPLE_FRESH_MS: number;
  /**
   * The FOUR used-of-maximum levels, and the bar and count formatter that
   * present them. Lifted here from this file in phase 2, 2026-09-01 — see
   * `usageLevelOf` below for what that seam was and why it closed.
   */
  usageLevelOf: (pct: unknown) => string | null;
  USAGE_CAUTION_PERCENT: number;
  USAGE_WARNING_PERCENT: number;
  USAGE_CRITICAL_PERCENT: number;
  usageBar: (pct: unknown) => string;
  BAR_FILL: string;
  BAR_EMPTY: string;
  BAR_CELLS: number;
  fmtCount: (n: unknown) => string;
  /**
   * The three that arrived with the owner's 2026-09-02 request — the wall
   * clock's spelling, and the abbreviation both directory fields are drawn
   * with. They come across the SAME bridge the bands do, for the same reason:
   * the strip draws these fields from this module directly, and a second
   * implementation on this side would be two spellings of one abbreviation
   * that a reader would have to notice disagreeing.
   *
   * That is a real improvement on the duration precedent one file over:
   * `formatDuration` is a COPY here pinned by `test/ui/duration-parity.test.ts`
   * because it must be synchronous and unit-testable, while these three are
   * only ever called from `buildLines`, which runs long after the top-level
   * `await` below has resolved. So there is nothing to pin — there is one
   * implementation.
   */
  wallStamp: (ms: unknown) => string | null;
  relDir: (dir: unknown, anchor: unknown) => string | null;
  corpusDir: (root: unknown, anchor: unknown, dirName?: string) => string | null;
}

async function loadBands(): Promise<BandModule | null> {
  try {
    const mod = (await import(LEVEL_SOURCE)) as Partial<BandModule>;
    if (typeof mod.occupancyLevel !== 'function' || typeof mod.occupancyBands !== 'function'
        || typeof mod.fillLevel !== 'function' || typeof mod.askHeadroom !== 'function'
        // The phase-2 arrivals are checked here too, so a `viewmodel.js` that
        // predates the lift is refused as a shape rather than answering
        // `undefined` four calls later.
        || typeof mod.usageLevelOf !== 'function' || typeof mod.usageBar !== 'function'
        || typeof mod.fmtCount !== 'function'
        // And the 2026-09-02 arrivals, checked here for the same reason: a
        // `viewmodel.js` that predates them is refused as a SHAPE rather than
        // answering `undefined` three calls later, in the middle of a field.
        || typeof mod.wallStamp !== 'function' || typeof mod.relDir !== 'function'
        || typeof mod.corpusDir !== 'function'
        // And the `seq:13` arrivals, for the third time and the same reason: a
        // `viewmodel.js` that predates the ask series is refused as a SHAPE
        // rather than answering `undefined` in the middle of the ask block.
        || typeof mod.askStepOf !== 'function' || typeof mod.asksLeft !== 'function'
        || typeof mod.handoverLag !== 'function' || typeof mod.askSeries !== 'function') {
      return null;
    }
    return mod as BandModule;
  } catch {
    return null;
  }
}

const BANDS: BandModule | null = await loadBands();

/** Whether the shared band logic actually loaded. Exported so a test can say so. */
export function bandsAreDerived(): boolean {
  return BANDS !== null;
}

/**
 * The four states the ctx block can be COLOURED for. `stale` is not a band —
 * it is the refusal to band a sample too old to present as current — but it is
 * a rendering, so it sits in the same union.
 */
export type Level = 'ok' | 'warn' | 'crit' | 'stale';

/**
 * The band a figure falls in, straight from the web's `occupancyLevel`.
 *
 * `null` when there is nothing to band: no threshold (the handover feature is
 * off, so there is no ask to name a band against), no percentage, or the shared
 * module did not load. The caller draws the neutral block, which is visibly
 * not-a-level rather than a level — never a guessed green.
 */
export function levelFor(percent: number, threshold: number | null, ageMs: number): Level | null {
  if (BANDS === null) return null;
  const level = BANDS.occupancyLevel(percent, threshold, ageMs);
  if (level === 'ok' || level === 'warn' || level === 'crit' || level === 'stale') return level;
  return null;
}

/** The two boundaries for a threshold, for anything that wants to name them. */
export function bandsFor(threshold: number | null): { warn: number; crit: number } | null {
  return BANDS === null ? null : BANDS.occupancyBands(threshold);
}

/** How old a sample may be and still be levelled — the web's own constant. */
export function freshMs(): number | null {
  return BANDS === null ? null : BANDS.CONTEXT_SAMPLE_FRESH_MS;
}

/**
 * **How far the ask is, in points of the window — the web's own subtraction.**
 *
 * Reached through the same bridge the bands are, and for the same reason: the
 * strip draws this distance beside its own marker, and a second
 * `threshold - percent` written here would be a second spelling of one number.
 *
 * `null` when the shared module did not load, which is the same degradation
 * every other reader of it takes: the block goes rather than being guessed.
 *
  * ── IT WENT UNCALLED FOR ONE REVIEW CYCLE, AND THE RECORD IS KEPT ──────
  *
  * The first cut of the used-of-maximum ruling replaced `◆ ask 85 · +3.2` with
  * the count pair `(81.8 / 85)`, on the reasoning that both figures were there
  * and the gap was one subtraction away — which left this function with no
  * caller at all. That was reported to the owner as a change to a RULED
  * behaviour rather than absorbed silently, and the owner ruled the number
  * back the same day: a distance a reader has to compute is not one they read
  * at a glance. `askSegment` calls it again, and the ask block now carries the
  * bar, the proportion, the counts AND the gap.
  *
  * The episode is worth the eight lines it costs. A function that goes
  * uncalled is usually deleted; this one was a ruled behaviour losing its last
  * consumer, and the only thing that made that visible was saying so plainly
  * in a comment instead of leaving it to be discovered.
 */
export function headroomFor(percent: number, threshold: number | null): number | null {
  if (BANDS === null) return null;
  const headroom = BANDS.askHeadroom(percent, threshold);
  return typeof headroom === 'number' && Number.isFinite(headroom) ? headroom : null;
}

/**
 * The four `seq:13` derivations, each a thin pass-through so that this file
 * has no arithmetic of its own to disagree with the strip's.
 *
 * `null` for every reason the shared module gives one, and additionally when
 * it did not load at all — a browser asset that has been moved is a reason to
 * lose a FIGURE, never a reason to invent one from remembered numbers.
 */
export function askStepOf(percent: number | null): number | null {
  if (BANDS === null) return null;
  const step = BANDS.askStepOf(percent);
  return typeof step === 'number' && Number.isFinite(step) ? step : null;
}

export function asksLeftAt(percent: number | null): number | null {
  if (BANDS === null) return null;
  const left = BANDS.asksLeft(percent);
  return typeof left === 'number' && Number.isFinite(left) ? left : null;
}

export function handoverLagOf(askedAtPercent: number | null, percent: number | null): number | null {
  if (BANDS === null) return null;
  const lag = BANDS.handoverLag(askedAtPercent, percent);
  return typeof lag === 'number' && Number.isFinite(lag) ? lag : null;
}

export function askSeriesOf(
  percent: number, threshold: number | null,
): { span: number; spent: number; percent: number; toFull: number } | null {
  if (BANDS === null) return null;
  return BANDS.askSeries(percent, threshold);
}

/**
 * **THE PALETTE, IN xterm-256 INDICES.**
 *
 * Zero runtime dependencies (`CONST-zero-runtime-dependencies`), so the escapes
 * are hand-rolled and the indices are the 256-colour cube rather than truecolor:
 * `38;5;N` is understood by every terminal that understands colour at all,
 * while `38;2;r;g;b` is not, and a status line that renders as garbage on one
 * machine is a status line that gets uninstalled.
 *
 * The three meaning hues are the NEAREST 256-colour neighbours of the web's own
 * `--ok`, `--warn` and `--crit` (`src/ui/public/styles.css` · `--gold:#e8c368; --ok:` · ~89),
 * and the neutral is `--dim`'s. They are approximations by construction — the
 * cube has 216 colours and the palette is free — so this table is written down
 * as an approximation and not as a second source of truth: what must agree
 * between the two surfaces is WHICH BAND a number is in, and that is derived
 * above, not chosen here.
 *
 * Foregrounds are near-black on every coloured block. The three meaning hues
 * are light enough that black clears 7:1 against all of them and white clears
 * none of them, so one rule covers the set instead of three exceptions.
 */
export interface Ink {
  /**
   * The xterm-256 index this field's TEXT is painted in.
   *
   * One index and not two, since the powerline frame went: there is no block
   * behind the text any more, so there is no background to choose. `fg` is
   * emitted as `38;5;N` and nothing emits `48;5;N` at all.
   */
  fg: number;
}

/**
 * **THE PALETTE, RE-DERIVED FOR FOREGROUND USE — 2026-09-01.**
 *
 * ── PALETTE TRIAL, 2026-09-01: the generator's four level colours ─────────
 *
 * Adopted ON TRIAL by owner ruling, in lockstep with `styles.css` — if the two
 * surfaces held different hues for one level they would disagree about what
 * `warning` looks like, which is the defect the shared band function exists to
 * prevent, one layer up. **Reverting is these four numbers:**
 *
 *     level      WAS  (ours)                NOW  (generator, approximated)
 *     safe       115  #87d7af  12.37:1      41   #00d75f  10.89:1   want #22c55e
 *     caution    179  #d7af5f  10.19:1      178  #d7af00  10.02:1   want #eab308
 *     warning    173  #d7875f   7.52:1      166  #d75f00   5.53:1   want #f97316
 *     critical   174  #d78787   7.70:1      203  #ff5f5f   7.05:1   want #ef4444
 *
 * **THE APPROXIMATION IS THE COST OF 256 COLOURS AND IT IS STATED, NOT HIDDEN.**
 * ΔE76 from the web's exact hex to the nearest xterm index: safe 11.1, caution
 * 7.2, warning 10.4, critical 10.1. Every one of those is a visible shift —
 * roughly the distance at which two colours become tellable apart — so the two
 * surfaces are near neighbours here rather than the same colour, which is the
 * same honest approximation this table has always been. What must agree between
 * them is WHICH BAND a number is in, and that is derived from one function, not
 * chosen here. `#22c55e` is the loosest fit, as the cube's greens are sparse.
 *
 * **Contrast on a black terminal moved, and one figure moved down.** `warning`
 * goes 7.52:1 -> 5.53:1. It still clears WCAG AA's 4.5:1 comfortably and it is
 * still not the only carrier — the icon and the label carry the level too — but
 * it is the lowest number on this bar and worth knowing before the trial is
 * made permanent. Adjacent-band separation improved: the worst pair goes from
 * ΔE 21.6 to 36.0.
 *
 * Dropping the powerline frame inverted every one of these. They used to be
 * BACKGROUNDS with near-black text on them, and the contrast that mattered was
 * black-on-hue; they are now the INK the text itself is drawn in, and the
 * contrast that matters is hue-on-terminal.
 *
 * **That is not a re-tint, it is a different measurement, and two of them
 * failed it.** Measured against a black terminal:
 *
 *     project  238  #444444   2.16:1   unreadable as text — REPOINTED to 252
 *     branch   244  #808080   5.32:1   thin as text       — REPOINTED to 245
 *     carry    104  #8787d7   6.48:1   legible            — REPOINTED to 111
 *
 * A background of 238 with white on it is a perfectly good block and a
 * perfectly invisible sentence. Carrying the old indices across would have
 * shipped a project name nobody could read, which is exactly the class of
 * defect a frame change hides: nothing errors, the field is simply gone.
 *
 * The four MEANING hues needed no repointing — they were chosen light enough
 * that black cleared 7:1 on them, and light-on-black is the same ratio the
 * other way up. They keep their indices, so the band a figure falls in is the
 * same colour it has been since the four levels landed.
 */
const INK = {
  /**
   * `--carry` — the web's #8b9ce6, at its nearest 256-colour neighbour.
   *
   * ONE declaration, TWO uses: the model block's tint, and — since gold moved
   * wholly to the `caution` band (`LEVEL_INK`) — the ask marker's. Naming it
   * once is what stops the terminal growing two spellings of one web token.
   *
   * **111 rather than 104 since the frame went.** As a background 104 was the
   * nearer match; as TEXT it measures 6.48:1 against a black terminal while
   * 111 measures 9.61:1 and is also the closer neighbour of `--carry` by ΔE
   * (8.8 against 9.6). The old choice was right for the old job.
   */
  carry: { fg: 111 },
  /**
   * The project and the branch — `--carry`, the same blue the strip gives
   * every unlevelled value since the owner's ruling of 2026-09-01.
   *
   * They were greys (252 and 245). The strip's rule is that white means a
   * NAME, blue means a FACT and the four hues mean a VERDICT; leaving these
   * grey here would have the two surfaces disagreeing about a register the
   * owner had just set, which is the drift the shared band function exists to
   * prevent one layer up. NEUTRAL IDENTITY, never severity: a repository is
   * not good or bad.
   *
   * The distinction the two greys carried — the branch dimmer than the project
   * — is not lost, it moves: the LABELS `REPO` and `BRANCH` say which is which
   * in words, which they did not before the labels ruling.
   *
   * **The numbers, since the move makes one of them dimmer.** 252 measured
   * 13.62:1 on black and 245 measured 6.08:1; 111 measures 9.61:1. So the
   * project name is dimmer than it was and the branch is brighter, and the
   * brightest non-meaning ink on the bar is now the LABEL rather than a value
   * — which is the right way round once white means "this is a name".
   */
  project: { fg: 111 },
  branch: { fg: 111 },
  /** `--ok` — calm. The generator's #22c55e at its nearest neighbour. 10.89:1. */
  ok: { fg: 41 },
  /** `--warn` — orange, approaching the ask with room to act. #f97316. 5.53:1. */
  warn: { fg: 166 },
  /** `--crit` — the window is nearly full. #ef4444. 7.05:1. */
  crit: { fg: 203 },
  /**
   * `--gold` — the `caution` band since the owner's ruling of 2026-09-01.
   * 10.19:1. No sixth colour is invented
   * (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`).
   */
  gold: { fg: 178 },
  /** `--dim` — NOT a level: stale, unmeasurable, or nothing to band against. */
  neutral: { fg: 145 },
  /**
   * **THE FIELD NAMES — `--ink`, the web's ordinary text white.**
   *
   * Owner ruling, 2026-09-01: *"the name could be in white and the field text
   * coloured"*. That is the right way round, and it does something the four
   * levels would otherwise have muddied: the NAME stays constant while only
   * the VALUE changes colour as a field moves safe -> caution -> warning ->
   * critical. A reader scanning the bar sees the names as fixed furniture and
   * the colour as the thing that moves, which is the two-line identity/state
   * split applied one level down, inside a single field.
   *
   * **Not a sixth meaning-hue, and that is the point of choosing white.**
   * `DEC-the-meaning-hue-budget-is-five-...` governs the hues that MEAN
   * something; white is the web's `--ink` (#f0eef6), the colour ordinary text
   * already is, and it means nothing — which is exactly what a label should
   * mean. Index 255 is its nearest neighbour (ΔE 4.2) at 18.10:1 on black.
   *
   * Deliberately NOT `neutral`/`--dim`: at 145 the names would be dimmer than
   * several of the values they sit beside, and a label a reader has to hunt
   * for is not a label. The separation that matters is name-versus-value, and
   * white against a coloured figure gives it in the direction the owner asked.
   */
  label: { fg: 255 },
} as const satisfies Record<string, Ink>;

/** The palette, exported so a test can assert the four ctx states differ. */
export const PALETTE: Record<string, Ink> = INK;

function inkForLevel(level: Level | null): Ink {
  if (level === 'ok') return INK.ok;
  if (level === 'warn') return INK.warn;
  if (level === 'crit') return INK.crit;
  // 'stale' and null alike: neutral. Neither is a band, and drawing either one
  // in a band's hue is the defect this whole state exists to prevent.
  return INK.neutral;
}

/* ══ TWO QUESTIONS, TWO FIELDS — owner ruling, 2026-08-31 ═══════════════════
 *
 * The bar was answering ONE question with the threshold-derived bands and the
 * owner reads TWO off it:
 *
 *   1. HOW FULL IS THE WINDOW — an absolute fact about the window, on fixed
 *      bands, and the same fact whatever anybody has configured.
 *   2. HOW CLOSE IS THE HANDOVER ASK — a fact about a threshold, derived from
 *      it exactly as the web strip derives it.
 *
 * They are not the same question and they were never going to agree: with the
 * threshold at 98 the ask is silent until 88.2%, which is well past the point a
 * reader wants the fill to have gone amber. So the fill gets the ok/warn/crit
 * hues and the ● ▲ ■ glyphs, and the ask gets ONE gold ◆ marker beside them.
 * No sixth hue (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`):
 * gold already exists and already means "your attention is wanted here".
 */

/**
 * **HOW FULL THE WINDOW IS — the absolute half, and it is IMPORTED.**
 *
 * This was a marked seam for the length of one afternoon: the ruling arrived
 * before the web lane had exported anything absolute, so the two boundaries
 * were restated here under a tripwire test. That lane has now landed
 * `CONTEXT_FILL_WARN_PERCENT`, `CONTEXT_FILL_CRIT_PERCENT` and `fillLevel` in
 * `src/ui/public/lib/viewmodel.js`, the tripwire fired exactly as it was
 * written to, and the restatement is gone: there is no copy of 60 or 85 in
 * this file, and no copy of the comparison either.
 *
 * `fillLevel` takes NO threshold, which is the whole point of the split. How
 * full a window is does not become a different fact because somebody
 * reconfigured when the handover fires; `askSegment` answers that other
 * question, from `occupancyLevel`, in the threshold's own units.
 */
export function fillBands(): { warn: number; crit: number } | null {
  return BANDS === null
    ? null
    : { warn: BANDS.CONTEXT_FILL_WARN_PERCENT, crit: BANDS.CONTEXT_FILL_CRIT_PERCENT };
}

/**
 * The band a figure falls in on the absolute scale, or `'stale'` for a sample
 * too old to be levelled at all.
 *
 * `null` when there is nothing to level, or when the shared module did not
 * load — and the caller then draws the neutral block, which is visibly
 * not-a-level rather than a guessed green.
 */
export function absoluteFillLevel(percent: number, ageMs = 0): 'ok' | 'warn' | 'crit' | 'stale' | null {
  if (BANDS === null) return null;
  const level = BANDS.fillLevel(percent, ageMs);
  if (level === 'ok' || level === 'warn' || level === 'crit' || level === 'stale') return level;
  return null;
}

/* ══ THE FOUR USED-OF-MAXIMUM LEVELS — READ, NEVER RESTATED ═══════════════
 *
 * **PHASE 2 LANDED ON 2026-09-01 AND THIS IS WHAT IS LEFT OF THE SEAM.**
 *
 * The three boundaries and the banding function lived here for exactly one
 * phase, fenced and dated, because extending `fillLevel`'s return set without
 * its `app.js` consumers would have sent the web strip's context figure and
 * both rate chips grey and LABELLED a `caution` window "comfortable" — a false
 * verdict on a surface, produced by a change confined to one file.
 *
 * They now live in `src/ui/public/lib/viewmodel.js` beside `fillLevel`, both
 * surfaces read them from there, and `test/cli/statusline-levels.test.ts`'s
 * TRIPWIRE — which failed the moment that file declared them — is what made
 * the move impossible to forget. There is no copy of 60, 70 or 80 in this
 * file and no copy of the comparison either.
 *
 * The bar characters and the count formatter moved with them, for the same
 * reason and to the same place: a bar whose filled-cell count differed between
 * the terminal and the browser would be two answers to one number.
 */

/** The four bands, safest first. Ordered, because the order is the meaning. */
export type UsageLevel = 'safe' | 'caution' | 'warning' | 'critical';

/**
 * The band a used-of-maximum percentage falls in — the web's own
 * `usageLevelOf`, through the same bridge the other bands come through.
 *
 * `null` when there is nothing to band OR when the shared module did not load,
 * which is the degradation every other reader of it takes: the caller draws
 * the neutral block rather than guessing a green.
 */
export function usageLevelOf(pct: number): UsageLevel | null {
  if (BANDS === null) return null;
  const level = BANDS.usageLevelOf(pct);
  if (level === 'safe' || level === 'caution' || level === 'warning' || level === 'critical') {
    return level;
  }
  return null;
}

/** The three boundaries, for anything that wants to name them. `null` when the shared module did not load. */
export function usageBands(): { caution: number; warning: number; critical: number } | null {
  return BANDS === null ? null : {
    caution: BANDS.USAGE_CAUTION_PERCENT,
    warning: BANDS.USAGE_WARNING_PERCENT,
    critical: BANDS.USAGE_CRITICAL_PERCENT,
  };
}


/**
 * The band, with the SHARED staleness refusal applied on top.
 *
 * `usageLevelOf` is pure and knows nothing about time; this wrapper adds the
 * one thing the terminal must not decide for itself — how old a sample may be
 * and still be banded — and it reads that from the web's own
 * `CONTEXT_SAMPLE_FRESH_MS` through `freshMs()`, exactly as `fillLevel` does.
 * No freshness number is spelled in this file.
 *
 * `'stale'` for a fossil and `null` for nothing-to-band; the caller draws the
 * neutral block for both, which is visibly not-a-level rather than a guess.
 */
export function usageLevel(pct: number, ageMs = 0): UsageLevel | 'stale' | null {
  const fresh = freshMs();
  if (fresh !== null && Number.isFinite(ageMs) && ageMs > fresh) return 'stale';
  return usageLevelOf(pct);
}

/**
 * **THE BAR — the web's `usageBar`, `BAR_FILL` and `BAR_EMPTY`, re-exported.**
 *
 * The owner named `▓▓▓░░░` and `■■■□□□` in the abstract, then wrote
 * `▰▰▰▰▰▱▱▱▱▱` twice in the reference they drew; the drawn thing won. The
 * characters moved into `lib/viewmodel.js` with the levels in phase 2, so a
 * bar's FILLED COUNT is one fact on both surfaces rather than two that happen
 * to match. Ten cells, and every character one display column — asserted by
 * the width tests, not assumed.
 *
 * `null`-safe fallbacks: if the shared module did not load, the terminal draws
 * an unfilled bar of the right width rather than an empty string, because a
 * bar that is sometimes zero cells wide breaks every alignment on the row.
 */
export const BAR_FILL: string = BANDS?.BAR_FILL ?? '▰';
export const BAR_EMPTY: string = BANDS?.BAR_EMPTY ?? '▱';
export const BAR_CELLS: number = BANDS?.BAR_CELLS ?? 10;

export function usageBar(pct: number): string {
  if (BANDS !== null) return BANDS.usageBar(pct);
  const exact = Number.isFinite(pct) ? (pct / 100) * BAR_CELLS : 0;
  const filled = Math.max(0, Math.min(BAR_CELLS, Math.round(exact)));
  return BAR_FILL.repeat(filled) + BAR_EMPTY.repeat(BAR_CELLS - filled);
}

/**
 * **THE LEVEL ICON — the generator's visual idea, on our data.**
 *
 * `safe` carries NO icon, which is the generator's own choice and the right
 * one: a calm bar should be quiet, and an icon on every field at every value
 * is an icon that has stopped meaning anything by the time it is needed —
 * the argument this file already makes about gold, in a second currency.
 *
 * Each icon is TWO display cells and `displayWidth` knows it. That rule was
 * fixed and tested BEFORE this table was allowed to exist, because five
 * fields' worth of undercount is a wrapped line, and wrapping is the one
 * failure this renderer must not have.
 */
export const LEVEL_ICON = {
  safe: '',
  caution: '\u26a0\ufe0f',
  warning: '\u{1f536}',
  critical: '\u{1f480}',
} as const satisfies Record<UsageLevel, string>;

/**
 * **THE FOUR LEVELS' INK — mapped onto EXISTING tokens, no sixth hue.**
 *
 * `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` assigns all
 * five meaning hues and forbids a sixth. Four levels need green, yellow,
 * orange and red, and the five already contain them:
 *
 *     safe      --ok    #7cc0a0   xterm 115   black on it  12.37:1
 *     caution   --gold  #e8c368   xterm 179                10.19:1
 *     warning   --warn  #c78f3d   xterm 173                 7.52:1
 *     critical  --crit  #e08b8b   xterm 174                 7.70:1
 *
 * **Adjacent-band separation, measured rather than eyeballed (CIE76 ΔE):**
 *
 *     safe    -> caution     terminal 51.6    web 51.7
 *     caution -> warning     terminal 26.4    web 20.1
 *     warning -> critical    terminal 21.6    web 41.5
 *
 * The worst pair is 20.1, comfortably above the ~10 at which two colours stop
 * being reliably told apart, so the ramp reads as four steps on both surfaces
 * rather than as three and a near-miss. That table is the justification the
 * owner asked to have recorded here.
 *
 * **AND IT COST THE ASK MARKER ITS HUE — owner ruling, 2026-09-01, not a side
 * effect.** `--gold` is the only unspent yellow, so `caution` needs it; gold
 * also meant "your attention is wanted here — a REQUEST, not a severity" and
 * sat on the `◆ ask` marker one block along on the same row. One hue on two
 * adjacent jobs is a hue doing neither, so the ask marker moved to `--carry`
 * (`INK.carry`). Each hue now has exactly one job, the budget of five is
 * untouched, and no sixth was invented.
 */
export const LEVEL_INK = {
  safe: INK.ok,
  caution: INK.gold,
  warning: INK.warn,
  critical: INK.crit,
} as const satisfies Record<UsageLevel, Ink>;

function inkForUsage(level: UsageLevel | 'stale' | null): Ink {
  // 'stale' and null alike: neutral. Neither is a band, and drawing either one
  // in a band's hue is the defect that state exists to prevent.
  return level === null || level === 'stale' ? INK.neutral : LEVEL_INK[level];
}

/**
 * The glyph each level carries, so the hue is never the only carrier.
 *
 * The same four the web strip's chip already uses
 * (`src/ui/public/app.js` · `chip.dataset.g = ` · ~614): `●` calm, `▲`
 * approaching, `■` at the limit, and `◌` for a state that is NOT a level —
 * stale, or unmeasurable — which is visibly not-a-verdict rather than a
 * quiet one.
 */
export const LEVEL_GLYPH = { ok: '●', warn: '▲', crit: '■', neutral: '◌' } as const;

export interface Segment {
  text: string;
  ink: Ink;
  /**
   * `true` for the one block a narrow terminal may shorten, and it shortens
   * from the LEFT (`…/my-context-test`) so the distinguishing tail survives.
   * A branch name's information is at its end; `campaign/my-…` throws away the
   * half that tells two branches apart.
   */
  elidable?: boolean;
  /**
   * `true` for a block that is never given up to make the line fit. Exactly
   * one block is: the context figure, which is the reason the bar exists.
   */
  required?: boolean;
  /**
   * `true` for the ONE block the line is centred on — the context figure, by
   * the owner's ruling of 2026-08-31 (see `buildSegments`).
   *
   * Separate from `required` rather than folded into it, because they are two
   * different claims about a block: `required` says "never give this up", and
   * `anchor` says "put this in the middle". A second block could earn the
   * first without earning the second, and a renderer that centred on
   * "whatever is required" would silently start centring on it.
   */
  anchor?: boolean;
  /**
   * The last-resort spelling of a REQUIRED block, for a terminal too narrow
   * for even that block: the context figure without its glyph, two cells
   * shorter. Used only after every optional block has already gone, and only
   * because the alternative is a line that wraps — which costs the user a row
   * of their transcript on every assistant message and is the one failure
   * this renderer must not have. The colour still carries the level; nothing
   * about the NUMBER is ever shortened.
   */
  terse?: string;
  /**
   * Bold. The ONE emphasis this bar has, and it exists so that "approaching
   * the ask" and "past the ask" can differ without a sixth hue: weight is not
   * a colour, and it survives a mono terminal and a forced-colors mode where a
   * second gold would not.
   *
   * Since 2026-09-01 it is also the CARRIER of the `critical` level, with the
   * blink as the extra — see `blink` immediately below.
   */
  bold?: boolean;
  /**
   * **BLINK — the owner asked for it, and it is never the carrier.**
   *
   * Set only on a `critical` block. SGR 5 is ignored outright by Windows
   * Terminal, by VS Code's integrated terminal and by iTerm2's default
   * profile, which is most of this bar's likely audience, so a level that
   * depended on it would be a level that usually did not render. It does not
   * depend on it: `critical` is told from `warning` by its ICON (💀 against
   * 🔶), by its HUE (ΔE 21.6 in the terminal), and by `bold`, which is a
   * weight rather than a colour and survives a mono terminal and a
   * forced-colors mode. The blink is the fourth carrier, not the first.
   *
   * Suppressed entirely by `MYCONTEXT_STATUSLINE_NO_BLINK` and by
   * `colour: false`. WCAG 2.2.2 asks that blinking content be stoppable, and
   * an escape is an escape: a bar rendered without colour emits no SGR 5
   * either.
   */
  blink?: boolean;
  /**
   * **THE FIELD'S NAME, drawn DIM to the left of its value.**
   *
   * ── OWNER RULING, 2026-09-01 ──────────────────────────────────────────────
   *
   * *"i want a field name on the left of every info because it's not self
   * explanatory"*. The bar was inconsistent about this: `ask`, `ctx`, `7d`,
   * `5h`, `myctx` and `log` carried names while the model, the project, the
   * branch, the session name, the cost and the cache share were bare values a
   * reader had to recognise. `$4093.42` and `99.7%` and `test_mycontext_plugin`
   * do not say what they are naming.
   *
   * **THE NAMES ARE THE WEB STRIP'S OWN**, from `strip.grp.*` in both string
   * tables — `model`, `repo`, `window`, `limits`, `corpus`, `session`,
   * `cost`, `audit`. Two surfaces that disagree about what a thing is CALLED
   * is the same defect class as two surfaces that disagree about what band it
   * is in, and it matters more now that the web strip is being restyled to
   * match this bar. Where a terminal field has no web counterpart the name is
   * invented in the same register, never in a second vocabulary.
   *
   * **UPPERCASE, by owner ruling — *"caps as name looks ok, use for both"* —
   * and on BOTH surfaces.** The strip already shouts these names; matching it
   * means the terminal and the browser cannot drift on what a field is called
   * OR on how it is written, which is the cheaper of the two available answers
   * now that the strip is being restyled to match this bar.
   *
   * Caps cost no extra columns in a monospace terminal, but they are LOUDER
   * than the value beside them, which is why the ink separation below is not
   * optional decoration: it is what stops a name outshouting the number it
   * names.
   *
   * **Drawn in `INK.label` — white — while the VALUE carries the colour**, by
   * the owner's ruling of 2026-09-01. So the name is fixed furniture and the
   * hue is the thing that moves as a field changes band. Under `NO_COLOR` that
   * separation is gone and only word order and spacing are left, which is why
   * the name is a single short word in FRONT and never a suffix or a bracket —
   * and that mode is checked by rendering rather than assumed.
   *
   * The level icons are NOT labelled: they sit inside a field that already has
   * a name, and naming the icon would name the same thing twice.
   */
  label?: string;
  /**
   * **WHICH FIELD THIS BLOCK IS, as a stable id — the unit of parity.**
   *
   * The web strip and this bar diverged because each was specified separately
   * with nothing holding them together, which is this project's most-repeated
   * defect and had been measured EIGHT times by 2026-09-01. What holds them
   * together now is `test/ui/strip-parity.test.ts`, and this tag is what it
   * compares: the strip carries the same ids in `data-f`, and the terminal's
   * set must be a SUBSET of the strip's. A field added here and nowhere there
   * fails that test by name.
   *
   * **It is an id, never a rendering.** Two surfaces are entitled to say one
   * fact differently — the browser can give the context figure a background
   * and a larger face and the terminal cannot — and nothing about presentation
   * travels through this. What travels is WHICH FACT is on the bar.
   *
   * A block that qualifies another block's absence carries the SAME id as the
   * block it qualifies: `myctx unavailable (…)` is the myctx field in its
   * absent state, not a field of its own. That is how the web strip already
   * renders `strip.myctxUnavailable`, and folding them keeps the comparison
   * about facts rather than about states.
   *
   * Absent on `ELLIPSIS_SEGMENT` alone, which is not a field: it is the mark
   * that says a field was dropped.
   */
  field?: string;
  /**
   * Where this block sits in the order the line gives itself up — see `GIVE`.
   * Lower goes first. Absent means "first of all", which is what an untagged
   * block should be: a block whose value nobody ranked has not earned a place
   * ahead of one somebody did.
   */
  give?: number;
}

/**
 * What a narrow terminal leaves behind, so a dropped block is still visible.
 *
 * Optional in its own right, and therefore the LAST thing given up: below the
 * width at which even one mark fits, the choice is between saying "something
 * was hidden" and saying how full the window is, and the second is what the
 * bar is for. Marked rather than truncated at every width above that one.
 */
export const ELLIPSIS_SEGMENT: Segment = { text: '…', ink: INK.neutral, give: 999 };

/**
 * How the context window's fullness reached this renderer.
 *
 * `unmeasurable` carries `readOccupancy`'s own three reasons and never collapses
 * them (`src/core/context-occupancy.ts` · `export type UnmeasurableWhy` · ~54):
 * they are three different things to tell a person and they have three
 * different fixes, and a reader told "not installed" about a bridge that IS
 * installed goes and installs it a second time.
 */
export type OccupancyView =
  | {
    state: 'known';
    percent: number;
    ageMs: number;
    /**
     * The two numbers the percentage was computed FROM, carried rather than
     * re-derived — since the owner's used-of-maximum ruling of 2026-09-01 the
     * bar draws `(549.0k / 1.0M)` beside the figure, and `percent/100 *
     * windowSize` would be a rounded reconstruction of a number this product
     * already has exactly. `core/context-occupancy.ts`'s `Occupancy` has
     * carried both on its known branch all along.
     */
    usedTokens: number;
    windowSize: number;
  }
  | { state: 'unmeasurable'; why: UnmeasurableWhy };

/** The short phrase each unmeasurable reason gets, kept distinct on purpose. */
const UNMEASURABLE_TEXT: Record<UnmeasurableWhy, string> = {
  'no-bridge': 'ctx — no bridge',
  'no-sample': 'ctx — no sample',
  'unknown-shape': 'ctx — unreadable',
  // `readOccupancy` gained this on 2026-08-31: the freshness gate moved to the
  // SERVER, so a fossil now arrives here already refused rather than as a
  // number this renderer has to decline to colour. `levelFor` still answers
  // `stale` for a figure that reaches it aged — the two agree because they read
  // one constant, and the block is the same either way.
  'stale': 'ctx — stale',
};

/**
 * The context block: the one that changes colour.
 *
 * A stale sample says `—` and never a number. The strip that read 60.1% while
 * the window was actually full is why: a figure that is 29 hours old is not a
 * smaller version of a fresh one, and rendering it as a percentage — in ANY
 * hue — invites the reader to act on it. The word `stale` rides beside the
 * dash so the grey is never carrying the fact alone.
 */
export function contextSegment(occ: OccupancyView): Segment {
  if (occ.state === 'unmeasurable') {
    return {
      text: `${LEVEL_GLYPH.neutral} ${UNMEASURABLE_TEXT[occ.why]}`,
      ink: INK.neutral, required: true, anchor: true, field: 'context',
    };
  }
  // ONE call answers both "how full" and "too old to say": `fillLevel` takes
  // the age and refuses to band a fossil, and it does so past the same
  // `CONTEXT_SAMPLE_FRESH_MS` the web strip and `readOccupancy` use. A
  // separate freshness check here would be a third place to disagree about
  // when a reading stops being current.
  const level = absoluteFillLevel(occ.percent, occ.ageMs);
  if (level === 'stale') {
    return {
      text: `${LEVEL_GLYPH.neutral} ctx — stale`,
      ink: INK.neutral, required: true, anchor: true, field: 'context',
    };
  }
  // **Since 2026-09-01 this is ONE CALL to the shared used-of-maximum
  // renderer**, and the only things that still make it different from the four
  // other fields are that it is `required` and that it is the `anchor`. The
  // band, the bar, the icon and the counts are not decided here — that is the
  // whole point of the ruling, and a second spelling of any of them in this
  // function would be the defect it was ruled to prevent.
  return usedOfMaxSegment({
    field: 'context',
    percent: occ.percent,
    // A real numerator and a real denominator, both carried on the payload
    // rather than reconstructed from the percentage.
    counts: `(${fmtCount(occ.usedTokens)} / ${fmtCount(occ.windowSize)})`,
    decimals: 1,
    suffix: '',
    required: true,
    anchor: true,
    ageMs: occ.ageMs,
  });
}

export interface MyctxBlock {
  tokens: number;
  injections: number;
  unrecorded: number;
}

/**
 * **ONE RENDERER FOR EVERY USED-OF-MAXIMUM FIELD** — owner ruling, 2026-09-01.
 *
 * The ruling that was easy to under-read: *"use the same controls for every
 * field that displays amount used from maximum available for context,
 * handover, used 5h, used 7d etc"*. So the treatment is not written five
 * times with five chances to drift — it is written HERE, once, and the five
 * fields differ only in the data they hand it.
 *
 * Each field renders as the owner's reference shape:
 *
 *     icon · label · bar · percentage · (used / max) · suffix
 *      💀     ctx    ▓▓▓▓▓▓▓▓▓░  88.0%  (880.0k / 1.0M)
 */
export interface UsedOfMax {
  /** The parity id — see `Segment.field`. Never a new one for this ruling. */
  field: string;
  /**
   * A qualifier that rides the NAME rather than the value — the myctx share
   * carries one always, because `core/context-share.ts` charges each item
   * once rather than once per delivery and can only BOUND what stays resident,
   * never measure it (eviction between compactions is invisible to the log).
   * `≥` when some deliveries also carry no frozen `tokens` estimate — the
   * true share is then at least this, on top of already being an upper bound
   * — and `≈` otherwise. Empty for every other field, which take their name
   * from `FIELD_NAME` alone.
   */
  qualifier?: string;
  /** Used, as a percentage of the maximum. MAY exceed 100 — see `usageBar`. */
  percent: number;
  /**
   * `(used / max)` — **or `null` where no real maximum exists**, which is not
   * a shortcut but the honest half of the ruling. The rate-limit windows carry
   * `used_percentage` and nothing else: no token count, no message count, no
   * denominator of any kind. `(59 / 100)` would print one number twice wearing
   * a slash and invent a maximum nobody served, so those two fields get the
   * icon, the bar and the percentage, and no counts. The owner was told which
   * fields this affects and why before it shipped.
   */
  counts: string | null;
  /** How many decimals the percentage carries. */
  decimals: number;
  /** A countdown or other trailing phrase, already spaced. Usually `''`. */
  suffix: string;
  /**
   * Where this field sits in the order the line gives itself up — `GIVE`.
   * ABSENT for a `required` block, because `GIVE`'s own rule is that the
   * context figure is never given up and therefore appears in no rank.
   */
  give?: number;
  required?: boolean;
  anchor?: boolean;
  /** Age of the reading, for the shared staleness refusal. 0 for live data. */
  ageMs?: number;
}

/**
 * The one block every used-of-maximum field is drawn as.
 *
 * **Colour is never the only carrier**, which is why this returns text and not
 * just an ink: the block reads `💀 ctx ▓▓▓▓▓▓▓▓▓░ 88.0% (880.0k / 1.0M)` in a
 * mono terminal, under `NO_COLOR`, in a screen reader and pasted into a
 * document. Take the hue away and every fact is still on the line — the icon,
 * the picture, the number and the two counts.
 *
 * A reading too old to band, or one that cannot be banded at all, keeps its
 * bar and its number and loses its ICON and its HUE: it is visibly
 * not-a-verdict rather than a quiet one, exactly as `fillLevel`'s `stale` is
 * treated everywhere else in this file.
 */
export function usedOfMaxSegment(f: UsedOfMax): Segment {
  const level = usageLevel(f.percent, f.ageMs ?? 0);
  const icon = level === null || level === 'stale' ? '' : LEVEL_ICON[level];
  const lead = icon === '' ? '' : `${icon} `;
  const figure = `${f.percent.toFixed(f.decimals)}%`;
  const counts = f.counts === null ? '' : ` ${f.counts}`;
  const name = `${FIELD_NAME[f.field] ?? f.field}${f.qualifier ?? ''}`;
  return {
    // The NAME is a `label` and not part of the text, so it is painted dim
    // while the value keeps its band's ink. The level icon leads the VALUE
    // rather than the name — it is a fact about the figure, and the owner's
    // ruling puts the name leftmost.
    label: name,
    text: `${lead}${usageBar(f.percent)} ${figure}${counts}${f.suffix}`,
    // The floor a terminal too narrow for the picture falls back to: the name
    // and the number, which is what this field said before the ruling. The bar
    // and the counts are the decoration; the FIGURE is never shortened.
    terse: figure,
    ink: inkForUsage(level),
    bold: level === 'critical',
    blink: level === 'critical',
    ...(f.give === undefined ? {} : { give: f.give }),
    field: f.field,
    ...(f.required === true ? { required: true } : {}),
    ...(f.anchor === true ? { anchor: true } : {}),
  };
}

/**
 * `549009` as `549,009` — the web's own `fmtCount`, re-exported.
 *
 * Owner's reference: `(90,000 / 200,000)`, not `(90.0k / 200.0k)`. It moved
 * into `lib/viewmodel.js` with the levels in phase 2 so the two surfaces
 * cannot punctuate one number two ways. `'?'` when the shared module did not
 * load, which is visibly not-a-number rather than a wrong one.
 */
export function fmtCount(n: number): string {
  return BANDS === null ? '?' : BANDS.fmtCount(n);
}

/**
 * **THE DATE AND TIME — and it is honestly a RENDER STAMP, not a clock.**
 *
 * ── THE TWO SURFACES CANNOT BEHAVE THE SAME HERE, AND SAYING SO IS THE
 *    FIELD'S WHOLE VALUE ─────────────────────────────────────────────────
 *
 * A terminal status line is drawn ON DEMAND: Claude Code runs this command
 * once per assistant message and displays whatever it printed until the next
 * one. **It cannot tick.** So a "current time" here is a fiction the moment it
 * is drawn, and what this field actually reports is WHEN THIS LINE WAS DRAWN —
 * which is the more useful of the two facts anyway, because it tells a reader
 * how stale everything ELSE on the bar is. A bar showing `ctx 90.3%` beside a
 * stamp forty minutes old is a bar to stop trusting, and nothing else on it
 * says so.
 *
 * The web strip CAN tick, and it does — `drawContext()` re-renders on the ping
 * cycle and computes this at draw time, exactly as it already computes
 * `formatAge` and `formatDuration` there. So the two surfaces WILL disagree,
 * by up to one assistant message on the terminal side.
 *
 * **THAT DISAGREEMENT IS CORRECT AND A FUTURE PARITY GATE MUST NOT READ IT AS
 * A DEFECT.** The owner's ruling of 2026-09-01 — *"every field that is also
 * displayed on the terminal status line should have exactly the same value in
 * the web status bar"* — is about a field whose VALUE is a measurement of the
 * same thing: `5d 8h` of elapsed session is `5d 8h` on both bars or one of
 * them is wrong. This field's value is a measurement of WHEN THE SURFACE LAST
 * PAINTED, and the two surfaces paint on different triggers. They agree on
 * MEANING — "this bar is current as of …" — and they agree, exactly, on the
 * spelling and the resolution, which is what `wallStamp` is for. A gate that
 * demanded equal SECONDS here would be demanding the terminal tick.
 *
 * `null` when the shared module did not load, which draws no field at all
 * rather than a date this file spelled for itself.
 */
export function stamp(now: number): string | null {
  return BANDS === null ? null : BANDS.wallStamp(now);
}

/** A directory relative to the launch directory — the web's own `relDir`. */
export function relDir(dir: string | null, anchor: string | null): string | null {
  return BANDS === null ? null : BANDS.relDir(dir, anchor);
}

/** A corpus root relative to the launch directory — the web's own `corpusDir`. */
export function corpusDir(root: string | null, anchor: string | null): string | null {
  return BANDS === null ? null : BANDS.corpusDir(root, anchor, DIR_NAME);
}

/**
 * How long this session has been running: `1h 24m`, `3m`, `2d 4h`.
 *
 * The `| 1h 24m` at the end of the owner's reference, from
 * `cost.total_duration_ms` — a field the payload has always carried and
 * nothing read until now.
 *
 * **Spaced `1h 24m`, and that differs from the countdowns' `·1d3h` on
 * purpose-by-instruction rather than by judgement:** it is the spelling the
 * owner drew. The two forms sit on different rows and play different parts —
 * one is a bare elapsed clock, the others are qualifiers bolted to a field —
 * but they are both two-unit durations and a single spelling would be tidier.
 * Flagged in the lane report; `since` and `until` are one edit away from
 * either answer.
 *
 * `null` for anything that cannot be a duration, which renders no field at
 * all rather than `0m`: a session whose length the payload did not report is
 * not a session zero minutes old.
 */
export function elapsed(ms: number | null): string | null {
  return ms === null ? null : formatDuration(ms, ' ');
}



/**
 * **The payload reader lives in `core/statusline-tee.ts` since 2026-09-01** —
 * the module that owns the tee owns the schema of what is teed. Re-exported
 * here, unchanged, because this file's callers name it by this path and
 * because the web strip now reads the same facts off the same function (see
 * that module for why a second reader would have been a second spelling of an
 * external schema).
 */
export { DEFAULT_EFFORT, payloadExtras } from '../../core/statusline-tee.ts';
export type { ModelModes, RateLimit } from '../../core/statusline-tee.ts';

export interface PowerlineInput {
  model: string | null;
  modes: ModelModes;
  project: string | null;
  branch: string | null;
  occupancy: OccupancyView;
  /** `handoverThresholdPercent`, or `null` when the handover feature is off. */
  threshold: number | null;
  /**
   * **WHAT BECAME OF THIS SESSION'S HANDOVER ASK, AND THE PERCENT IT FIRED
   * AT** — `plan:handover seq:13`. See `handoverSegment`.
   *
   * `null` where the question could not be asked at all: no corpus, or no
   * session key to look a latch up by. That is NOT `verdict: 'off'`, which is
   * a measured "nobody configured this".
   */
  handoverAsk: HandoverAskView | null;
  /** The two windows Claude Code reports, either or both absent. */
  fiveHour: RateLimit | null;
  sevenDay: RateLimit | null;
  /** `cost.total_cost_usd`. */
  costUsd: number | null;
  /**
   * `cost.total_duration_ms` — how long this session has been running, drawn
   * as the `1h 24m` that closes the owner's reference bar.
   */
  elapsedMs: number | null;
  /**
   * `session_name` — the name the user gave THIS window, straight off the
   * payload we already parse. `null` when Claude Code sent none.
   *
   * Drawn only when it differs from the project name (`buildLines`), because
   * a session called after its project restates a block already on the line.
   * Its whole job is telling two windows apart when the model, the project and
   * the branch are identical in both, which is the ordinary case for anyone
   * running more than one.
   */
  sessionName: string | null;
  /**
   * The share of this turn's input the cache served, DERIVED and not sent:
   * `cache_read_input_tokens` over the input total Claude Code itself
   * displays (`input + cache_creation + cache_read`, the same arithmetic
   * `classifyContext` does for the occupancy). `null` when the payload does
   * not carry the three numbers to derive it from.
   */
  warmPercent: number | null;
  myctx: MyctxBlock | null;
  /**
   * What mycontext currently has in focus, already rendered to a phrase by
   * `describeFocus`, or `null` for no focus.
   *
   * The one field on this bar that says what the session is FOR rather than
   * what it is consuming — and after a compaction it answers the question a
   * reader actually has, which is not "how full am I" but "where was I".
   * Capped to `FOCUS_MAX` columns here; see there.
   */
  focus: string | null;
  /**
   * The newest audit row and when it was written, or `null` where there is
   * no corpus to have a log -- the same meaning `myctx: null` carries.
   */
  lastAudit: LastAudit | null;
  /** Why the myctx half is MISSING. */
  myctxNote: string | null;
  /** Why the sample did not reach disk. Two facts, two fields — see below. */
  teeNote: string | null;
  /**
   * **WHERE THIS SESSION IS RUNNING NOW** — `cwd` off the payload, absolute.
   *
   * Owner, 2026-09-02: *"Twice today a stray `cd` moved the session's working
   * directory into `my-context/`, which silently switched every hook onto a
   * nested 44-item corpus instead of the real 759-item one. It went unnoticed
   * for minutes."* Nothing on either bar said where the session was, so
   * nothing could say that it had moved.
   *
   * Absolute here and ABBREVIATED at the draw — see `relDir`, which is where
   * the argument for the abbreviation lives.
   */
  cwd: string | null;
  /**
   * `workspace.project_dir` — where the session was LAUNCHED. It does not
   * move, so it is the ANCHOR the two directory fields are drawn against and
   * never a field of its own: a constant on a status bar is furniture.
   */
  projectDir: string | null;
  /**
   * **WHICH CORPUS THE SESSION'S DIRECTORY ACTUALLY RESOLVES TO**, and whether
   * that resolution is the alarm.
   *
   * ── WHY THE CORPUS IS DRAWN AND NOT ONLY THE DIRECTORY ──────────────────
   *
   * The directory is the CAUSE; the corpus is the EFFECT, and the effect is
   * what changed behaviour. A reader who sees `CWD ./my-context` still has to
   * know that `my-context/` holds a corpus of its own before that means
   * anything; a reader who sees `CORPUS ./my-context — 44 items, 759 above`
   * needs to know nothing. The MCP server has printed exactly this on every
   * tool result since 2026-08-27 (`src/mcp/provenance.ts`) and this is the
   * same disclosure on the surface that is always visible.
   *
   * **Resolved from `cwd` and not from the workspace this command already
   * built**, and that difference IS the field. `cmdStatusline` resolves its
   * workspace from `project_dir` first, deliberately, so a tee can never land
   * in another project's `.statusline/`. The HOOKS resolve theirs by walking
   * up from wherever they are RUN. When those two answers differ, the bar is
   * reading one corpus while the session is writing to another — which is the
   * failure, stated.
   *
   * **No second resolver.** This is `core/corpus-identity.ts`'s own
   * `resolveCorpus`, the same function `toolResultProvenance` calls, carrying
   * its own `nesting` block — the enclosing root and both item counts, taken
   * by its own walk. Two resolvers that could disagree about which corpus is
   * in play would be a particularly bad version of the defect this field
   * exists to expose.
   *
   * `null` when nothing resolved it — no session directory to walk up from.
   */
  corpus: CorpusResolution | null;
}

/**
 * **THE ORDER THE LINE GIVES ITSELF UP IN.**
 *
 * Lower goes first. This is a ranking of VALUE, and it is written down as one
 * table rather than left implicit in the order the blocks are pushed, because
 * "which block would you rather lose" is a question the owner answers and a
 * later reader has to be able to find the answer to.
 *
 * The two rules it encodes: the context figure is never given up (it is
 * `required` and appears in no rank), and the rate-limit windows are the last
 * things given up before it — a window that is about to close is the one fact
 * on this bar that a person cannot recover by looking somewhere else.
 *
 * The mark itself ranks above every real block, so `…` is what survives when
 * nothing else can, and below nothing: it is given up only when even one cell
 * of "something is hidden" costs the context figure its place.
 */
/**
 * A payload that carried none of the optional groups.
 *
 * The five fields stay REQUIRED on `PowerlineInput` rather than optional, so
 * that a sixth group added later breaks every caller instead of silently
 * rendering as absent at one of them. This is how a caller that genuinely has
 * nothing to say says so — once, by name, instead of five nulls at a time.
 */
export const NO_EXTRAS: Pick<
  PowerlineInput,
  'modes' | 'fiveHour' | 'sevenDay' | 'costUsd' | 'elapsedMs' | 'warmPercent' | 'sessionName'
  | 'cwd' | 'projectDir' | 'handoverAsk'
> = {
  modes: { effort: null, thinking: null, fastMode: null, exceeds200k: null },
  /**
   * **`null` is "the question could not be asked", never "the feature is
   * off"** — `plan:handover seq:13`. A caller with no corpus and no session
   * key has no latch to read and no verdict to render, and `handoverSegment`
   * draws nothing for it. The feature being SWITCHED OFF is a measurement, and
   * it arrives as `verdict: 'off'` on a real view.
   */
  handoverAsk: null,
  fiveHour: null,
  sevenDay: null,
  costUsd: null,
  elapsedMs: null,
  warmPercent: null,
  sessionName: null,
  cwd: null,
  projectDir: null,
};

export const GIVE = {
  costCache: 10,
  /**
   * The two 2026-09-01 additions, ranked BELOW everything that was already
   * here so that no existing block's position moved — the owner reviewed this
   * table for the single-line bar and did not reopen it.
   *
   * Focus goes first of all and the session name second: both are worth having
   * and neither is worth a block that says where you are. A window you cannot
   * identify is still a window whose project and branch you can read.
   */
  focus: 4,
  sessionName: 6,
  /**
   * Ranked with the line-3 conveniences. It is the field the owner's reference
   * closes on, so it is drawn LAST and given up EARLY — those are not in
   * tension: where a field sits is about reading order, and what it is worth
   * is about which field a narrow terminal would rather lose. A session clock
   * is pleasant; a rate window about to close is not recoverable elsewhere.
   */
  elapsed: 9,
  /**
   * Ranked with the other line-2 conveniences rather than above them. The
   * block matters MOST exactly when it is stale -- which is when it also
   * turns `warn` -- but a narrow terminal that has already given up the cost
   * and the share is not a terminal that should start evicting the owner's
   * ranked fields for a health signal. The hue does the shouting; the rank
   * stays low.
   */
  lastAudit: 8,
  myctxShare: 20,
  project: 30,
  branch: 40,
  model: 50,
  handoverDue: 60,
  /**
   * **Ranked immediately below the ask it is about** — `plan:handover seq:13`.
   *
   * The two are one subject and this is the half that can be recovered
   * elsewhere: the strip draws the same verdict, and the model is told it in
   * words on the ask turn itself. The MEASUREMENT is the half a reader has
   * nowhere else to get, so a terminal too narrow for both keeps the bar.
   *
   * Below `model` and above `notes` for that reason and no other: it is worth
   * more than a note about why another field is missing, and less than the
   * name of the thing you are talking to.
   */
  handoverVerdict: 70,
  notes: 80,
  sevenDay: 90,
  fiveHour: 92,
  /**
   * **THE TWO 2026-09-02 ADDITIONS RANK ABOVE EVERY OTHER REAL BLOCK, and
   * that is a claim worth arguing rather than a slot that was free.**
   *
   * Every other field on this bar is a MEASUREMENT. These two say WHICH
   * PROJECT the measurements were taken from. If the corpus is the wrong one,
   * the myctx share, the audit clock and the focus are all correct readings of
   * a project the reader is not working on — and there is nothing else on the
   * bar that could reveal it. A rate window outranked by this is still true
   * whichever corpus is loaded; a rate window is a fact about the account.
   *
   * **THE HIGH RANK IS NOW ALSO PAYING FOR WIDTH, and that is the trade.**
   * Until 2026-09-02 the quiet spelling was `CWD .` and `CORPUS .` — nineteen
   * columns for the pair, labels and separators included — and the owner could
   * not read either of them. The dot has been replaced by the launch
   * directory's own name (`relDir`, which carries the whole argument), so the
   * quiet pair now costs fifty-nine columns and line 1 measures 204 on the
   * live payload against 164 before. The alarm is unchanged at 210.
   *
   * **What a narrower terminal actually gives up was MEASURED, not reasoned
   * about**, by rendering the live payload at each width:
   *
   *     210   everything, untouched
   *     200   the branch elides four code points from the LEFT — `…ign/…`
   *     190   the branch is down to `…text-test`
   *     183   the branch is a bare `…` and the SESSION NAME goes
   *
   * So at the owner's ~200-column terminal the whole row still fits and the
   * cost is four characters off the head of a branch name whose tail is the
   * half that distinguishes it — `fitSegments` step 1, which exists for
   * exactly this. The session name is the first BLOCK to go and it is the
   * right one to lose: a window whose project, branch, directory and corpus
   * are all on the line is a window the reader can already place. These two
   * stay ranked above every measurement for the reason above, and `clock`
   * (`give: 7`) is ranked to go before either of them.
   *
   * The corpus above the directory, because the corpus is the effect: given
   * one block, a reader would rather be told which corpus is in play than
   * which directory caused it.
   */
  cwd: 94,
  corpusRoot: 95,
  /**
   * Ranked with the line-3 conveniences, beside `elapsed`. Knowing when the
   * bar was drawn is worth having and is not worth a field that says which
   * corpus drew it — and a reader whose terminal is too narrow for this one
   * still has a wall clock on their own machine.
   */
  clock: 7,
  mark: 999,
} as const;

/**
 * **HOW MANY COLUMNS A FOCUS PHRASE MAY OCCUPY.**
 *
 * A focus is user-authored — an item id, a tag expression, a path glob — and
 * nothing bounds how long the user makes it. Unbounded, one long focus pushes
 * line 1 past the terminal and `fitSegments` starts giving up the project and
 * the branch to pay for it: a field nobody ranked would be evicting fields the
 * owner did rank.
 *
 * Truncated from the RIGHT and marked, which is the opposite of the branch's
 * rule and right for the opposite reason: a branch's distinguishing half is
 * its tail (`campaign/my-context-test`), while a focus reads as a phrase and
 * its head is what identifies it (`plan:walk seq:…`).
 */
export const FOCUS_MAX = 28;

export function focusText(focus: string): string {
  const trimmed = focus.trim();
  const points = [...trimmed];
  return points.length <= FOCUS_MAX ? trimmed : `${points.slice(0, FOCUS_MAX - 1).join('')}…`;
}

function fmtK(n: number): string {
  return `${(n / 1000).toFixed(1)}k`;
}

/**
 * **THE ONE SPELLING OF A DURATION ON THIS SURFACE**, and the twin of
 * `formatDuration` in `src/ui/public/lib/viewmodel.js`.
 *
 * This arithmetic was written out THREE times in this file -- `until`, `since`
 * and `elapsed` -- and a fourth time in `viewmodel.js`, which is why the web
 * bar drew `5d` where this bar drew `5d 8h` for the same millisecond count.
 * The doc that used to sit above `elapsed` already flagged it: *"a single
 * spelling would be tidier ... `since` and `until` are one edit away from
 * either answer."* The owner picked the answer on 2026-09-01: *"every field
 * that is also displayed on the terminal status line should have exactly the
 * same value in the web status bar full resolution"*.
 *
 * **Why a copy and not an import.** `viewmodel.js` is untyped JavaScript and
 * `tsconfig.json` sets no `allowJs`, so a static import of it does not compile;
 * the bands next door take the same file by DYNAMIC import behind a runtime
 * arrival check for exactly that reason, and that machinery is async while
 * these three are sync and unit-tested. So this stays a copy -- but a copy that
 * `test/ui/duration-parity.test.ts` sweeps against `viewmodel.js`'s across
 * boundaries and randomised spans, which is the difference between two copies
 * PROVEN equal and four copies hoped equal.
 *
 * `sep` is the only permitted difference, because the owner drew both
 * spellings: a bare elapsed clock reads `5d 8h`, a qualifier bolted to a field
 * reads `1d3h`.
 */
function formatDuration(ms: number, sep = ''): string | null {
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

/**
 * A countdown to a UNIX-SECONDS instant, at most two units wide: `1d4h`,
 * `3h12m`, `47m`, `now`.
 *
 * Two units and not one because a rate-limit window is read to decide whether
 * to start something: `1d` and `1d23h` are the same block and a very different
 * decision. Two units and not three because this is a status LINE.
 *
 * `null` for anything that cannot be turned into a duration — an absent field,
 * a non-finite number, a reset already in the past by more than its own
 * rounding. A countdown that has run out says nothing rather than counting
 * upwards, which would read as a window that is somehow more than closed.
 */
export function until(resetsAtSeconds: number | null, now: number): string | null {
  if (resetsAtSeconds === null || !Number.isFinite(resetsAtSeconds)) return null;
  return formatDuration(resetsAtSeconds * 1000 - now);
}

/**
 * **IS THIS MACHINE STILL RECORDING ANYTHING AT ALL** - owner ruling,
 * 2026-09-01, replacing a narrower "are the hooks working" signal.
 *
 * The newest row in the audit log, and how long ago it was written. It is
 * strictly larger than hook health -- hooks are one of the things that write
 * rows -- and it is the question a reader can act on: a newest row three hours
 * old, in a session somebody has been working in all evening, is a finding,
 * and no other field on either line would reveal it.
 *
 * It is also the general instrument for this project's most repeated defect.
 * A stale context sample presented as live; a spawner that stood down and
 * stopped looking; an injection count that spanned fourteen days; a summary
 * that went stale on a retitle -- every one of them is *something stopped
 * being current and nothing said so*. A visible timestamp on the newest row is
 * the one field that catches that class at the source rather than an instance
 * at a time.
 *
 * **Three states, kept apart, and that is the point of the type.** An EMPTY
 * log and a FAILED read are different facts: "nothing has been recorded" is a
 * measurement, "I could not tell" is not, and a bar that renders them
 * identically has destroyed the only difference that matters. This is
 * `readOccupancy`'s distinguished-reasons precedent applied to a second
 * mechanism (`core/context-occupancy.ts`).
 */
export type LastAudit =
  | {
    state: 'known';
    /** The newest row's `op`, verbatim -- `subagent-stop`, `create`, `jit`. */
    op: string;
    /**
     * The newest row's `at`, ISO-8601, PASSED THROUGH AND NEVER AGED HERE.
     *
     * The age is computed in `lastAuditSegment` from the `now` it is given,
     * which is `buildLines`'s `now`, which is render time. A duration frozen
     * when the value was fetched is the fossil defect this product has now
     * shipped three times, and a field whose entire job is to age correctly is
     * the last place to reintroduce it.
     */
    at: string;
  }
  | { state: 'empty' }
  | { state: 'unreadable' };

/**
 * How long ago, at most two units: `4h12m`, `2m`, `now`.
 *
 * `until`'s mirror, deliberately the same shape and the same two-unit rule, so
 * a reader who has learned a countdown on a rate-limit window reads this one
 * without learning anything new. `null` for a stamp this code cannot parse --
 * an unparseable date is not an age of zero.
 */
export function since(at: string, now: number): string | null {
  const then = Date.parse(at);
  if (!Number.isFinite(then)) return null;
  return formatDuration(Math.max(0, now - then));
}

/**
 * The audit block: `log subagent-stop`, with its age, or a named absence.
 *
 * **The staleness mark is DERIVED, not chosen.** Past `CONTEXT_SAMPLE_FRESH_MS`
 * -- `lib/viewmodel.js`'s own constant, the same one that decides a context
 * sample is too old to present as current -- the block goes `warn`. Reusing it
 * is the honest reading rather than a convenience: the constant answers "how
 * long before a reading stops being evidence of a live session", and a log
 * that has recorded nothing for that long is the same claim about the same
 * session. No threshold is spelled here, and if that constant moves this moves
 * with it.
 */
export function lastAuditSegment(last: LastAudit | null, now: number): Segment | null {
  if (last === null) return null;
  if (last.state === 'empty') {
    return {
      text: '— nothing recorded', label: FIELD_NAME['last-audit'],
      ink: INK.neutral, give: GIVE.lastAudit, field: 'last-audit',
    };
  }
  if (last.state === 'unreadable') {
    return {
      text: '— unreadable', label: FIELD_NAME['last-audit'],
      ink: INK.warn, give: GIVE.lastAudit, field: 'last-audit',
    };
  }
  const ago = since(last.at, now);
  if (ago === null) {
    // A stamp this product wrote and cannot parse. Not an age of zero, and not
    // silence either: the row is there and its date is not readable.
    return {
      text: `${last.op} — undated`, label: FIELD_NAME['last-audit'],
      ink: INK.warn, give: GIVE.lastAudit, field: 'last-audit',
    };
  }
  const fresh = freshMs();
  const stale = fresh !== null && now - Date.parse(last.at) > fresh;
  return {
    text: `${last.op} ·${ago}`,
    label: FIELD_NAME['last-audit'],
    // Blue while it is merely a fact; `warn` once it IS the finding.
    ink: stale ? INK.warn : INK.carry,
    give: GIVE.lastAudit,
    field: 'last-audit',
  };
}

/**
 * One rate-limit block: `7d 49% ·1d4h`.
 *
 * **Banded by the SAME function the context figure is**, against the same
 * threshold, so there is exactly one place in this product where a percentage
 * becomes a colour. Inventing a second set of boundaries for rate limits —
 * "amber at 75, red at 90", say — would be the defect the brief named: two
 * tables that must agree and no mechanism making them.
 *
 * `null` when the window carries no percentage. A reset time with no
 * percentage is a countdown to nothing in particular.
 */
export function rateLimitSegment(
  limit: RateLimit | null, now: number, give: number, field: string,
): Segment | null {
  if (limit === null || limit.usedPercent === null || !Number.isFinite(limit.usedPercent)) {
    return null;
  }
  const left = until(limit.resetsAt, now);
  const countdown = left === null ? '' : ` ·${left}`;
  // Age 0: a rate-limit window arrives with the payload being read right now,
  // so there is no such thing as a stale one. `usageLevel`'s `'stale'` branch
  // is unreachable from here and is not pretended otherwise.
  return usedOfMaxSegment({
    field,
    percent: limit.usedPercent,
    // **NO COUNTS, and that is the ruling's honest half rather than a gap.**
    // The payload carries `used_percentage` for these two windows and NOTHING
    // else — no token count, no message count, no denominator at any level.
    // `(59 / 100)` would print one number twice wearing a slash and invent a
    // maximum nobody served, which is a worse failure than an absent pair. The
    // icon, the bar and the percentage all apply honestly, and all appear.
    counts: null,
    decimals: 0,
    suffix: countdown,
    give,
    ageMs: 0,
  });
}

/**
 * **HOW FAR THE HANDOVER ASK IS** — the second of the two questions this bar
 * answers, as a NUMBER.
 *
 * ── OWNER RULING, 2026-08-31 ────────────────────────────────────────────────
 *
 * This block used to be SILENT below `threshold * OCCUPANCY_WARN_FRACTION`, so
 * the bar answered "how far am I from the ask" only once the answer was
 * "nearly there". The owner ruled that the distance is worth reading at any
 * fill, and chose this rendering — "headroom" — over a drawn ruler, because it
 * is the only candidate that is IDENTICAL in a mono terminal, with no Nerd
 * Font, under `NO_COLOR`, in a screen reader, and pasted into a document. A
 * number is not a picture and does not degrade like one.
 *
 *   below the ask   `◆ ask 85 · +59.9`   the gap, in points of the window
 *   approaching     `◆ ask 85 · +3.2`    same shape, smaller number
 *   at or past it   `◆ handover due`     the number is spent; the words take over
 *
 * The distance is `threshold - percent` in percentage POINTS, at the same one
 * decimal place the ctx block uses, so the two figures beside each other are
 * read in the same units and subtract in the reader's head.
 *
 * **The band is still not decided here.** `levelFor` is `occupancyLevel`,
 * whose `warn` opens at `threshold * OCCUPANCY_WARN_FRACTION` and whose `crit`
 * IS the threshold. This function chooses no boundary; it only spells what the
 * shared module answered.
 *
 * **GOLD IS STILL EARNED, AND THIS IS THE ONE JUDGEMENT INSIDE THE RULING.**
 * The owner's three examples were given in plain text, so they fix the WORDS
 * and not the hue. Gold means "your attention is wanted here"
 * (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`), and a
 * block that is gold on every bar at every fill — including a window at 25%
 * with sixty points of head-room — is a hue that has stopped meaning anything
 * by the time it is needed. So the WORDS appear at every fill, as ruled, and
 * the gold arrives with the `warn` band: dim while there is nothing to act on,
 * gold when the ask is approaching, gold and bold when it has fired. The
 * marker glyph `◆` is present throughout, so nothing about the block's
 * IDENTITY moves — only its urgency. This is flagged in the lane report as the
 * one thing the owner may want to overrule with a word.
 *
 * `null` for a corpus with the handover feature off (no ask, so no distance to
 * it), for an unmeasurable window, and for a fossil: nothing is claimed about
 * proximity to an ask from a reading that is not current.
 */
export function askSegment(occ: OccupancyView, threshold: number | null): Segment | null {
  // Both refusals FIRST, and the threshold one is not merely a type guard: no
  // configured ask means there is no distance to anything, and a headroom
  // measured against a threshold nobody set would be a number invented here.
  if (occ.state !== 'known' || threshold === null) return null;
  const level = levelFor(occ.percent, threshold, occ.ageMs);
  // `stale` and `null` alike: a reading that cannot be banded cannot be
  // measured against the ask either. A fossil with sixty points of head-room
  // is not reassurance, it is a stale claim wearing a plus sign.
  if (level === null || level === 'stale') return null;

  // ── PAST THE ASK, THE WORDS TAKE OVER — owner ruling, 2026-09-01 ──────────
  //
  // Asked whether this block should run on past its maximum as
  // `💀 ask ▓▓▓▓▓▓▓▓▓▓ 104% (88.0 / 85)`, the owner ruled that it should NOT:
  // *past the ask the number stops being the point, the action is.* So the
  // field is banded and barred all the way UP to the threshold and becomes
  // words at it — which is also the one place on this bar where a used-of-max
  // field would have had to draw a bar with no eleventh cell and a percentage
  // over 100.
  //
  // The condition is `occupancyLevel`'s `crit`, which IS `pct >= threshold`,
  // imported rather than re-compared: "has the ask fired" is one question with
  // one answer, and a second comparison here would be a second chance to
  // disagree with the strip about it.
  if (level === 'crit') {
    // ── PAST THE ASK THE BAR RE-ORIGINS ON THE THRESHOLD — `plan:handover
    //    seq:13`, and it is the fix for a field that was STALE BY CONSTRUCTION.
    //
    // `seq:12` made the ask a SERIES: it re-arms on every whole percent from
    // the threshold to 100, so a threshold of 85 earns up to sixteen of them.
    // A words-only block from 85 to 100 says the same three words for the last
    // fifteen points of the window — the fifteen points where the asks
    // actually happen — and a reader who saw `handover due` at 85 and again at
    // 99 learned nothing from the second one.
    //
    // So the measurement continues instead of stopping: `askSeries` measures
    // the SAME window from the threshold rather than from zero, and the bar
    // fills from the ask to full. It is not the context figure wearing a
    // second label — at 96.3% with T=85 this reads 75% and the window reads
    // 96.3% — and the band it earns escalates with it, which is what the flat
    // `carry` could not do.
    //
    // **The words survive as the NAME**, `ASK DUE`, which is the one part of a
    // field a narrow terminal never shortens away separately: the owner's
    // 2026-09-01 ruling was that past the ask *the action is the point*, and
    // the action is still said — it has moved to the label, where it is said
    // on every one of the sixteen steps rather than instead of them. What
    // BECAME of the ask is the `handover-verdict` block beside this.
    const series = askSeriesOf(occ.percent, threshold);
    const left = asksLeftAt(occ.percent);
    if (series !== null) {
      return usedOfMaxSegment({
        field: 'ask',
        qualifier: ' DUE',
        percent: series.percent,
        // Points of the window, exactly as the sub-threshold form's counts
        // are: `spent` of the `span` between the ask and full. One decimal on
        // the numerator because it is the figure that MOVES; the span is a
        // whole number of points because the threshold is read as configured.
        counts: `(${series.spent.toFixed(1)} / ${series.span})`,
        decimals: 0,
        // The same `·+` the sub-threshold form spends, and deliberately the
        // same MEANING: points of the window to the next boundary. Below the
        // ask that boundary is the ask; past it there is nothing above but
        // full, so it counts to 100.
        //
        // **And then the count of asks still to come**, which is the fact that
        // stops the next one being a surprise. Two qualifiers on one `·` rail,
        // in two units that cannot be confused: `+3.7` is POINTS of window and
        // `4 left` is a count of ASKS — one per whole percent above the one
        // this window is in. It is an upper bound and the word is chosen to
        // say so: an ask fires on a `Stop` that lands inside a percent, and a
        // window that jumps two points in one turn earns one ask, not two.
        // `0 left` is drawn rather than hidden — "no more are coming" is worth
        // exactly as much as "four are".
        suffix: ` ·+${series.toFull.toFixed(1)}${
          left === null ? '' : ` ·${left} left`}`,
        give: GIVE.handoverDue,
        ageMs: occ.ageMs,
      });
    }
    // The floor, and it is the block this field drew before `seq:13`: a
    // threshold at or above the ceiling leaves no series to draw a proportion
    // over, and the shared module not loading leaves no arithmetic at all.
    // Losing the words as well as the figure would be the wrong trade.
    return {
      // **`--carry`, not gold, since 2026-09-01.** Gold moved wholly to the
      // `caution` band (`LEVEL_INK`), and one hue on two adjacent jobs is a
      // hue doing neither. Bold still carries the urgency, and bold is a
      // weight rather than a colour.
      text: `${ASK_GLYPH} handover due`,
      // NAMED like every other field, by the owner's ruling: the words say
      // what has happened, and the name still says which field it happened to.
      // A single unnamed block on a bar where everything else is named is the
      // inconsistency the ruling was about.
      label: FIELD_NAME['ask'],
      ink: INK.carry, bold: true, give: GIVE.handoverDue, field: 'ask',
    };
  }

  // The threshold reads as CONFIGURED — `85`, not `85.0`. `fmtThreshold` is
  // that one rule, shared with `handoverSegment` rather than written twice.
  const ask = fmtThreshold(threshold);
  // **THE ASK AS USED-OF-MAXIMUM.** The maximum is the threshold and the used
  // figure is the window's own percentage — both already in percentage points
  // of the window — so `(65.0 / 85)` reads in the same units as the ctx figure
  // immediately beside it and subtracts in the reader's head. This is the
  // shape the owner ruled every used-of-max field takes.
  //
  // ── AND THE HEADROOM IS PRINTED BESIDE IT — owner ruling, 2026-09-01 ──────
  //
  // The first cut of this block dropped the printed distance, on the reasoning
  // that `(65.0 / 85)` carries both figures and the gap is one subtraction
  // away. That was flagged to the owner rather than absorbed, and the owner
  // ruled the number back: the 2026-08-31 ruling is that *the distance to the
  // ask is worth reading at any fill*, and a distance a reader has to COMPUTE
  // is not one they read at a glance. So the block carries all four — bar,
  // proportion, counts, and the gap.
  //
  // **`+` is what makes it a DISTANCE rather than a fourth ratio.** Nothing
  // else on this bar wears a leading plus: `%` marks a proportion, `$` money,
  // `·` a trailing qualifier. It is also the exact token the owner has been
  // reading since 2026-08-31 — `+59.9`, `+3.2` — so it is recognised rather
  // than learned, and it rides the `·` the countdown already uses because it
  // is the same kind of thing: a qualifier after the figure, not part of it.
  //
  // **One decimal, always**, for the reason the superseded block gave and
  // which has not changed: this is the figure that MOVES, and a gap showing
  // `+3` for anything between 2.5 and 3.5 hides the last message before the
  // ask. Percentage POINTS of the window — the same units as the count pair
  // beside it and the ctx figure one block along.
  //
  // The subtraction is IMPORTED (`headroomFor`, and through it
  // `lib/viewmodel.js`'s `askHeadroom`), never repeated here: the web strip
  // draws the same distance, and two spellings of one arithmetic is how two
  // surfaces come to disagree about one number.
  //
  // It appears at NO other fill state than this one. Past the ask the block is
  // `◆ handover due` and returned above, so a negative gap or a `+0.0` can
  // never be printed beside the words — that would be two answers to one
  // question. With no threshold configured, and for a fossil, the whole block
  // is already `null`: nothing is claimed about proximity to an ask that does
  // not exist, or from a reading that is not current.
  //
  // `null` degrades to NO SUFFIX rather than to no block. Unreachable today —
  // `headroomFor` answers `null` only when the shared module did not load, and
  // `levelFor` has already returned `null` for that above — but losing the
  // bar, the proportion and the counts because one trailing figure went
  // missing would be the wrong trade if that ever stopped being true.
  const headroom = headroomFor(occ.percent, threshold);
  return usedOfMaxSegment({
    field: 'ask',
    percent: (occ.percent / threshold) * 100,
    counts: `(${occ.percent.toFixed(1)} / ${ask})`,
    decimals: 0,
    suffix: headroom === null ? '' : ` ·+${headroom.toFixed(1)}`,
    give: GIVE.handoverDue,
    ageMs: occ.ageMs,
  });
}

/** The ask marker. Gold, and never one of the fill glyphs. */
export const ASK_GLYPH = '◆';

/**
 * **WHAT BECAME OF THE STANDING HANDOVER, MEASURED IN PERCENT** — the block
 * this bar did not have, and the one `plan:handover seq:12` made sayable.
 *
 * SERVED, never derived here. `core/handover-ask.ts` owns the verdict — its
 * own header calls the comparison the whole feature, *the flag is not a claim,
 * it is a comparison* — and `AskLatch.askedAtPercent` owns the percent the
 * last ask fired at. This block reads both and subtracts; it decides nothing.
 *
 * ── WHY PERCENT AND NOT AGE ────────────────────────────────────────────────
 *
 * The strip said `handover written 3h ago` and the terminal said nothing at
 * all. Age is a proxy for currency and it is the measure that HID the defect:
 * three windows reported `acted-on` with the handover 2h39m, 1h24m and 3h06m
 * behind — written at 85% and carried to 99.9%, 96.1% and 96.6%. "Written 3h
 * ago" teaches a reader the wrong thing twice, that something happened and
 * that time is the unit. The unit is percent, because a percent of the window
 * is a quantity of work the handover does not describe.
 *
 * So the sentence is the PAIR — the percent the standing handover answers and
 * the percent the window is at now — and the staleness is visible as the two
 * numbers that caused it rather than as an interval that hides them.
 *
 * ── THE STATES, AND WHY NONE OF THEM IS A GUESS ────────────────────────────
 *
 *   lag 0     `current at 96%`                 the ask this answers is the
 *                                              percent the window is in
 *   lag > 0   `written at 85%, now 96%`        eleven points of work it does
 *                                              not mention — warn, not crit:
 *                                              behind is not missing
 *   lag < 0   `answers 96%, window since reset` the latch outlived its window.
 *                                              A `/clear` destroys a window and
 *                                              `core/window-state.ts` does not
 *                                              remove the latch (`AskLatch`'s
 *                                              header says why), so a fresh
 *                                              window can read a percent above
 *                                              its own. NOT KNOWN, never a
 *                                              confident `current at 96%`.
 *   lag null  `answers the 85% ask`            asked, and no live reading to
 *                                              measure it against
 *   ignored   `asked at 96%, not written`      the loud one, and the one a
 *                                              reader would never go and check
 *   not-asked `first ask at 85%`               a measured not-yet, with the
 *                                              percent it starts at
 *
 * `off` draws NOTHING here, and that is the one place this block declines to
 * name an absence. The strip says `no handover configured` because it is a
 * page a person opens; this is a line redrawn on every assistant message, and
 * a sentence that is identical forever is furniture rather than information —
 * the same argument `askSegment` already makes for returning `null` with no
 * threshold configured, one block along.
 *
 * `null` also for an ask block that was never read, which is not `off`: "the
 * feature is switched off" is something this command measured, and "the latch
 * could not be read" is not.
 */
export interface HandoverAskView {
  verdict: HandoverAskVerdict;
  /**
   * `AskLatch.askedAtPercent` — the whole percent the most recent ask fired
   * at, already normalised through `askStep`, or `null` for a window that has
   * never been asked.
   */
  askedAtPercent: number | null;
}

export function handoverSegment(
  ask: HandoverAskView | null, occ: OccupancyView, threshold: number | null,
): Segment | null {
  if (ask === null || ask.verdict === 'off') return null;
  const base = { label: FIELD_NAME['handover-verdict'], give: GIVE.handoverVerdict, field: 'handover-verdict' as const };

  if (ask.verdict === 'unverifiable') {
    return { ...base, text: 'state not known', ink: INK.neutral };
  }
  if (ask.verdict === 'not-asked') {
    // The threshold is what makes this a MEASURED not-yet rather than an
    // absence: it names the percent the first ask fires at, so the reader
    // knows what has not happened and when it will. A `not-asked` with no
    // threshold cannot happen — the verdict requires a configured handover —
    // and if it ever did, the words alone are still true.
    return {
      ...base,
      text: threshold === null ? 'not yet asked' : `first ask at ${fmtThreshold(threshold)}%`,
      ink: INK.carry,
    };
  }

  // Only a KNOWN and current reading may stand on the right of the pair. A
  // fossil measured against a live latch would print a percentage that has not
  // been true for hours, which is the exact defect this block exists to end —
  // so the same staleness refusal `askSegment` applies is applied here.
  const live = occ.state === 'known' && levelFor(occ.percent, threshold, occ.ageMs) !== 'stale'
    ? occ.percent
    : null;
  const asked = ask.askedAtPercent;
  const lag = handoverLagOf(asked, live);
  const nowStep = askStepOf(live);

  if (ask.verdict === 'ignored') {
    return {
      ...base,
      text: asked === null
        ? 'asked and not written'
        : `asked at ${asked}%, not written`,
      // The loudest hue in the budget, for `handoverVerdictChip`'s reason: the
      // ask went out, the file did not move, and nothing else on either bar
      // would ever say so.
      ink: INK.crit, bold: true,
    };
  }

  // `acted-on` from here down.
  if (lag === null) {
    return {
      ...base,
      text: asked === null ? 'written after the ask' : `answers the ${asked}% ask`,
      ink: INK.carry,
    };
  }
  if (lag < 0) {
    return { ...base, text: `answers ${asked}%, above this window`, ink: INK.neutral };
  }
  if (lag === 0) {
    return { ...base, text: `current at ${nowStep}%`, ink: INK.ok };
  }
  return {
    ...base,
    text: `written at ${asked}%, now ${nowStep}%`,
    ink: INK.warn,
  };
}

/** A threshold reads as CONFIGURED — `85`, not `85.0`. One spelling, three sites. */
function fmtThreshold(threshold: number): string {
  return Number.isInteger(threshold) ? String(threshold) : threshold.toFixed(1);
}

/** The model block, with the modes that are not the ordinary case folded in. */
export function modelSegment(model: string | null, modes: ModelModes): Segment | null {
  // **Which modes are worth drawing is `modeFlags`', and it is shared.** The
  // web strip folds the same words in beside the model name, and "which words
  // count as not the ordinary case" is one judgement about an external payload
  // rather than two. Words and not glyphs, for the reason it always was: a bare
  // mark carries meaning only to a reader who already knows it.
  const flags = modeFlags(modes);
  const name = model === null || model === '' ? null : model;
  if (name === null && flags.length === 0) return null;
  const text = [name, ...flags].filter((part) => part !== null).join(' ');
  return {
    text, label: FIELD_NAME['model'], ink: INK.carry, give: GIVE.model, field: 'model',
  };
}

/**
 * The blocks, in order, before anything is fitted to a width.
 *
 * The four the owner drew are the spine. Everything else appears ONLY when it
 * has something to say, which is what keeps an ordinary session's bar exactly
 * as drawn while a session in trouble grows the blocks that say so:
 *
 *  - `myctx` is what mycontext put into THIS window, from the injection
 *    records' own frozen estimates, bounded to the current compaction epoch
 *    and to the ops that reach this model (`core/context-share.ts`). `≥` when
 *    some records carry no estimate, because the true share is at least this
 *    and the block says exactly that.
 *  - `myctxNote` and `teeNote` are TWO fields and not one, because folding
 *    them drops whichever did not win: `writeTee` refuses an unsafe
 *    `session_id` while `myctxShare` answers for that same id perfectly well,
 *    so a single note shown only when the share is absent would print a
 *    confident myctx figure and never mention that the web UI is getting
 *    nothing.
 *  - the ask block is DERIVED from the band and never decided again: `crit`
 *    is `pct >= threshold`, which is the definition of the ask firing. A
 *    second comparison here would be a second chance to disagree with the
 *    strip about whether the ask is live.
 *
 * ── WHERE THE CONTEXT BLOCK SITS, AND HOW MANY LINES THERE ARE ─────────────
 *
 * **SUPERSEDED RULING, kept because it was a ruling and it was reasoned.**
 * Until 2026-08-31 this comment read:
 *
 * > The context block stays LAST whatever else is present, because the owner's
 * > ruling is that the right end of the bar is what shifts as the window fills
 * > — a block after it would move the thing the eye is trained on.
 *
 * **Superseded twice on 2026-08-31, and both steps are recorded** because the
 * second only makes sense as an answer to what the first cost:
 *
 *   1. **Centre the context figure** (owner ruling). It is the most important
 *      information on the bar and the centre is where the eye lands. Measured
 *      afterwards, the bar needed 234 columns to actually centre — the ask
 *      scale is a permanent ~19-cell block sitting left of the anchor — and
 *      the owner's terminal is 200+, so at their real width it never centred.
 *   2. **Split the bar across TWO LINES** (owner ruling, the live one). Line 1
 *      is identity and never changes; line 2 is everything that moves. The
 *      reason is a reading habit rather than a width: after ten minutes a
 *      reader stops looking at line 1 at all, so every changing number belongs
 *      on one line and motion never appears where the eye has learned that
 *      nothing does. It also puts the ask and the context figure ADJACENT,
 *      which is the comparison the owner actually performs — and it halves the
 *      heavier side, which is what made centring reachable at a real width.
 *
 * There is ONE live ruling here and a dated record of the two it replaced. A
 * later reader who finds only the quotation above has found history, not a
 * second instruction.
 *
 * `buildSegments` is now DERIVED from `buildLines` rather than the other way
 * round, so the one-line fallback cannot contain a different set of blocks
 * from the two-line form: it is the same two groups, concatenated. A block
 * added to either line appears in both spellings or in neither.
 */
export interface StatusLines {
  /**
   * Line 1: who and where. Static for the whole session — the model and its
   * modes, the project, the branch, the session name, the focus.
   */
  identity: Segment[];
  /**
   * **LINE 2: THIS WINDOW.** The ask and the context figure, and nothing else.
   *
   * ── WHY A THIRD ROW EXISTS AT ALL — owner ruling, 2026-09-01 ─────────────
   *
   * It was not assumed, it was MEASURED and then asked for. The four-level
   * treatment adds an icon, a ten-cell bar, a percentage and a count pair to
   * every used-of-maximum field, and the single line-2 those five fields would
   * have shared came to **215 columns** against a terminal of about 200. The
   * standing instruction for that case is *"if there is no room on the
   * terminal, ask me what to cut"*, so the measurement went back with four
   * options and the owner chose the row over the cut: nothing is truncated,
   * no field is dropped, and no count is invented to make the arithmetic work.
   *
   * The split is not merely "the first two that fit". These two answer ONE
   * question asked twice — how full is the window, and how far is the ask —
   * and they are the two fields a reader acts on. Alone on their own row at
   * ~80 columns they are read as a pair, which is the comparison the owner
   * actually performs.
   */
  window: Segment[];
  /**
   * **LINE 3: THE ACCOUNT AND THE LEDGER.** The two rate-limit windows, the
   * myctx share, the cost and cache, and the audit clock.
   *
   * Everything here is true of the account or of the session's history rather
   * than of the context window in front of the reader. It moves, so it does
   * not belong on line 1; it is not what the reader acts on this turn, so it
   * does not belong beside the ask.
   */
  account: Segment[];
}

export function buildLines(input: PowerlineInput, now: number = Date.now()): StatusLines {
  const identity: Segment[] = [];
  const window: Segment[] = [];
  const state: Segment[] = [];

  const model = modelSegment(input.model, input.modes);
  if (model !== null) identity.push(model);

  if (input.project !== null && input.project !== '') {
    identity.push({
      text: input.project, label: FIELD_NAME['project'],
      ink: INK.project, give: GIVE.project, field: 'project',
    });
  }
  if (input.branch !== null && input.branch !== '') {
    identity.push({
      text: input.branch, label: FIELD_NAME['branch'],
      ink: INK.branch, elidable: true, give: GIVE.branch, field: 'branch',
    });
  }

  // ── WHERE THE SESSION IS, AND WHICH CORPUS THAT GOT IT — owner request,
  //    2026-09-02, and the coordinator's ruling the same day that BOTH are
  //    drawn rather than one standing in for the other.
  //
  // Line 1 because they are IDENTITY: they do not move on the per-message
  // clock line 2 runs on, and when they do move that IS the news. Immediately
  // after the branch, so the row reads outward in one direction — the tool,
  // the repository, the branch, the directory inside it, and the corpus that
  // directory resolved to.
  //
  // Both are drawn relative to the launch directory: the quiet session NAMES
  // that directory and the broken one draws its descent from it. See `relDir`
  // in `lib/viewmodel.js` for why that is the abbreviation and not a truncated
  // absolute path, and for why the quiet answer stopped being `.` on
  // 2026-09-02.
  const where = relDir(input.cwd, input.projectDir);
  if (where !== null) {
    identity.push({
      text: where, label: FIELD_NAME['cwd'],
      // Unlevelled identity, so `--carry` and not a hue: a working directory
      // is not good or bad. The VERDICT about it, when there is one, is the
      // corpus block immediately after — which is the right place for it,
      // because a directory that has moved is only a problem if the corpus
      // moved with it.
      ink: INK.carry, give: GIVE.cwd, field: 'cwd',
    });
  }
  const corpus = corpusSegment(input.corpus, input.projectDir);
  if (corpus !== null) identity.push(corpus);

  // **Only when it differs from the project.** A session named after its
  // project restates a block already two along, and the owner's instruction
  // was explicit: this field exists to tell two windows apart, and a window it
  // cannot distinguish is a window it should say nothing about. Compared
  // trimmed and case-insensitively, because "My-Context" and "my-context" are
  // the same answer to "which window is this".
  // **The suppression rule is `distinctSessionName`', and it is shared.** The
  // web strip applies the same one, server-side, on the same field: two
  // spellings of "only when it tells two windows apart" is two bars that
  // disagree about whether to draw a block.
  const named = distinctSessionName(input.sessionName, input.project);
  if (named !== null) {
    identity.push({
      text: named, label: FIELD_NAME['session-name'],
      ink: INK.carry, give: GIVE.sessionName, field: 'session-name',
    });
  }

  // Focus last on line 1: it is the narrowest thing said there — the tool, the
  // repository, the branch, this window, and finally what this window is FOR.
  if (input.focus !== null && input.focus.trim() !== '') {
    identity.push({
      text: focusText(input.focus), label: FIELD_NAME['focus'],
      // An unlevelled VALUE, so `--carry` and not `--dim`: dim means "no
      // verdict here" and is reserved for stale and unmeasurable states.
      ink: INK.carry, give: GIVE.focus, field: 'focus',
    });
  }

  // ── line 2, in the owner's order ──
  // The ask first and the context figure immediately after it: they are one
  // question asked twice — how full, and how far from the ask — and putting a
  // block between them would be read as belonging to neither.
  const ask = askSegment(input.occupancy, input.threshold);
  if (ask !== null) window.push(ask);
  // Immediately after the ask and BEFORE the window figure, because it is the
  // ask's own second half: how far the ask is, then what became of the last
  // one, then how full the window is. Putting it after the context figure
  // would separate the two blocks that share a subject with the one that does
  // not — the mistake the comment above warns about, one field along.
  const handover = handoverSegment(input.handoverAsk, input.occupancy, input.threshold);
  if (handover !== null) window.push(handover);
  window.push(contextSegment(input.occupancy));

  // **Written as a table so each window's FIELD ID is a `field:` property.**
  // That is the one form `test/ui/strip-parity.test.ts` derives both surfaces'
  // field sets from — an id passed as a bare positional argument would be
  // invisible to it, and a derivation with a blind spot is a hand-kept list
  // wearing a regex. The web strip's `rateLimitParts` is written the same way,
  // with the same two ids.
  for (const w of [
    { field: 'rate-7d', limit: input.sevenDay, give: GIVE.sevenDay },
    { field: 'rate-5h', limit: input.fiveHour, give: GIVE.fiveHour },
  ]) {
    const seg = rateLimitSegment(w.limit, now, w.give, w.field);
    if (seg !== null) state.push(seg);
  }

  if (input.myctx !== null && input.myctx.injections > 0) {
    // `≥` when some deliveries carry no frozen `tokens` estimate — the true
    // share is at least this, on top of already being an upper bound — and
    // `≈` otherwise. Never blank: `context-share.ts` charges each item once
    // rather than once per delivery, which fixed the figure sailing past the
    // window, but it can only BOUND what is resident, never measure it —
    // eviction between compactions is invisible to this log. A figure that
    // cannot be exact must not be drawn as though it were, so this always
    // carries a qualifier now, same as the count it replaced always carried
    // one when some records predated the estimate.
    const approx = input.myctx.unrecorded > 0 ? '≥' : '≈';
    // ── THE FIFTH USED-OF-MAXIMUM FIELD — owner ruling, 2026-09-01 ──────────
    //
    // This block was a bare count and it is genuinely used-of-max by the same
    // definition as the context figure and against the SAME denominator: what
    // mycontext put into this window, out of the window. Asked whether it
    // qualified, the owner ruled that it does, so it takes the identical
    // treatment rather than sitting beside four banded fields as the one
    // number nobody banded.
    //
    // **It needs the window to be measurable, and says so when it is not.**
    // The denominator IS `occupancy.windowSize`, so an unmeasurable window
    // leaves this field with no maximum — and it then draws the bare count it
    // always drew rather than inventing a percentage. A field that quietly
    // switched denominators would be worse than one that visibly has none.
    const win = input.occupancy.state === 'known' ? input.occupancy.windowSize : null;
    if (win !== null && win > 0) {
      state.push(usedOfMaxSegment({
        field: 'myctx',
        // The qualifier rides the NAME, never the bar or the counts, because
        // it qualifies the NUMERATOR: `≈` says the figure is a bound rather
        // than a measurement (each item counted once, eviction invisible);
        // `≥` says it is ALSO missing some recorded tokens on top of that.
        qualifier: ` ${approx}`,
        percent: (input.myctx.tokens / win) * 100,
        // The counts stay a plain pair — the qualifier on the name already
        // says what they cannot be taken to mean exactly.
        counts: `(${fmtCount(input.myctx.tokens)} / ${fmtCount(win)})`,
        decimals: 1,
        suffix: '',
        give: GIVE.myctxShare,
        ageMs: 0,
      }));
    } else {
      state.push({
        text: `${approx}${fmtK(input.myctx.tokens)}`,
        label: FIELD_NAME['myctx'],
        ink: INK.carry,
        give: GIVE.myctxShare,
        field: 'myctx',
      });
    }
  } else if (input.myctxNote !== null) {
    // The SAME field id as the share above, in its absent state — see
    // `Segment.field`. The strip draws exactly this pairing already
    // (`strip.myctx` and `strip.myctxUnavailable`), and a block that explains
    // why a field is missing is not a second field.
    state.push({
      text: `unavailable (${input.myctxNote})`, label: FIELD_NAME['myctx'],
      ink: INK.neutral, give: GIVE.notes, field: 'myctx',
    });
  }
  // The two notes are DISCLOSURES and they belong with the state, not with the
  // identity: a tee that stopped landing is news, and news goes on the line the
  // reader is still looking at.
  if (input.teeNote !== null) {
    // **The CONTEXT field, in its absent state, and that is not a dodge.** A
    // tee that did not reach disk is the reason there is no context sample to
    // draw, and the web strip says the same thing with `strip.ctx.noBridgeShort`
    // — the observable consequence of the same failure. Giving it a field id of
    // its own would demand the browser draw a fact it cannot observe: the write
    // happens in this process, and a page that can stat nothing cannot know it
    // failed. Tagged as the field it qualifies, per `Segment.field`.
    state.push({ text: input.teeNote, ink: INK.warn, give: GIVE.notes, field: 'context' });
  }

  // Cost and cache in one block: they are one question — what this turn is
  // costing and how much of it the cache is absorbing — and two blocks would
  // spend a separator saying nothing.
  const cost = input.costUsd === null || !Number.isFinite(input.costUsd)
    ? null : `$${input.costUsd.toFixed(2)}`;
  const warm = input.warmPercent === null || !Number.isFinite(input.warmPercent)
    ? null : `warm ${input.warmPercent.toFixed(1)}%`;
  if (cost !== null || warm !== null) {
    state.push({
      text: [cost, warm].filter((part) => part !== null).join(' · '),
      label: FIELD_NAME['cost-cache'],
      ink: INK.carry,
      give: GIVE.costCache,
      field: 'cost-cache',
    });
  }

  // Last, and on the line that moves, because it IS a clock. `now` is render
  // time and the age is computed from it here -- never carried in aged.
  const log = lastAuditSegment(input.lastAudit, now);
  if (log !== null) state.push(log);

  // **HOW LONG THIS SESSION HAS RUN** — the `1h 24m` the owner's reference
  // closes on, and the last field on the bar for the same reason it is last
  // there. Absent when the payload carried no duration, which renders nothing
  // rather than `0m`: a session whose length nobody reported is not one that
  // has just started.
  const ran = elapsed(input.elapsedMs);
  if (ran !== null) {
    state.push({
      text: ran, label: FIELD_NAME['elapsed'],
      ink: INK.carry, give: GIVE.elapsed, field: 'elapsed',
    });
  }

  // **WHEN THIS LINE WAS DRAWN** — last of all, on the row that moves, for the
  // same reason the audit clock is on it: it IS a clock. `now` is render time
  // and is never carried in aged.
  //
  // Beside `AUDIT`, deliberately: that field says how LONG AGO the log last
  // moved and this one says as of WHEN, and the pair is what turns a relative
  // age into an absolute instant a reader can compare against anything else.
  const at = stamp(now);
  if (at !== null) {
    state.push({
      text: at, label: FIELD_NAME['clock'],
      ink: INK.carry, give: GIVE.clock, field: 'clock',
    });
  }

  return { identity, window, account: state };
}

/**
 * **WHICH CORPUS THIS SESSION'S DIRECTORY RESOLVED TO — and the alarm.**
 *
 * ── THE INTERESTING STATE IS DISAGREEMENT, NOT THE PATH ─────────────────────
 *
 * A corpus resolved from a directory that sits inside a project is normal and
 * unremarkable, and a bar that spent forty-six columns saying so every message
 * would have taught its reader to stop looking at it long before the day it
 * mattered. What is NOT ordinary is a walk that stopped at a NESTED corpus
 * while another one stands higher up the same tree: that is the shape of the
 * failure the owner reported twice on 2026-09-02, and `resolveCorpus` already
 * detects and describes it for the MCP surface.
 *
 * So this block has two spellings and they are deliberately unalike:
 *
 *     CORPUS test_mycontext_plugin                  the ordinary case, a place
 *     CORPUS ▲ ./my-context — 44 items, 759 above   the alarm
 *
 * **THE COUNTS RIDE THE ALARM, AND THEY ARE THE POINT.** The outage this all
 * comes from was not somebody misreading a path — it was reading "44 items" as
 * a project with little recorded in it rather than as A DIFFERENT CORPUS.
 * `nestedCorpusNote` prints both numbers for exactly that reason and this is
 * the same disclosure at bar width. They cost two recursive `items/` walks,
 * paid ONLY in the alarm state, which is the state where a person is about to
 * make a decision on this line.
 *
 * **The hue is `warn` and it is not the carrier.** The glyph `▲`, the word
 * `items`, the two numbers and the changed SHAPE of the value all say it
 * without any colour at all — `src/ui/public/06-a11y.html`'s rule, and what
 * makes `renderPowerline({ colour: false })` a real degradation here.
 *
 * `null` for no resolution at all, and a NAMED `none` for a session that
 * resolved to no corpus: those are different sentences
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`), and only
 * the first is silence.
 */
export function corpusSegment(
  resolution: CorpusResolution | null, anchor: string | null,
): Segment | null {
  if (resolution === null) return null;
  const label = FIELD_NAME['corpus-root'];
  if (resolution.root === null) {
    return {
      text: 'none', label, ink: INK.neutral, give: GIVE.corpusRoot, field: 'corpus-root',
    };
  }
  const where = corpusDir(resolution.root, anchor);
  // The shared module did not load, so there is no abbreviation to draw and
  // this file may not spell one of its own. Silence, exactly as `fmtCount`
  // answers `'?'` rather than punctuating a number for itself.
  if (where === null) return null;
  const nesting = resolution.nesting;
  if (nesting === null) {
    return {
      text: where, label, ink: INK.carry, give: GIVE.corpusRoot, field: 'corpus-root',
    };
  }
  return {
    text: `${LEVEL_GLYPH.warn} ${where} — ${nesting.items} items, ${nesting.enclosingItems} above`,
    // The last-resort spelling for a terminal too narrow for the disclosure:
    // the glyph and the path, which is still an alarm and still says which
    // corpus. The COUNTS are the explanation and the explanation is what a
    // narrow terminal gives up — never the fact that something is wrong.
    terse: `${LEVEL_GLYPH.warn} ${where}`,
    label, ink: INK.warn, give: GIVE.corpusRoot, field: 'corpus-root',
  };
}

/**
 * The same blocks as ONE line — the fallback, and the whole of it.
 *
 * Derived by concatenation so it can never disagree with `buildLines` about
 * what the bar contains. This is what a terminal or a Claude Code build that
 * mishandles a second line gets: one line carrying everything, which is the
 * honest degradation. A second line silently lost is the failure this project
 * spends an `…` mark to avoid everywhere else.
 */
export function buildSegments(input: PowerlineInput, now: number = Date.now()): Segment[] {
  const { identity, window, account } = buildLines(input, now);
  return [...identity, ...window, ...account];
}


// --- Rendering --------------------------------------------------------------

const CSI = '\u001b[';
const RESET = `${CSI}0m`;

/**
 * The escapes that open one field. FOREGROUND ONLY since the frame went —
 * `38;5;N` and never `48;5;N`, because there is no block behind the text to
 * fill any more.
 *
 * `22m` and not `0m` to leave bold: a full reset would drop the colour set on
 * the same escape and repaint every following field from scratch.
 *
 * **`25m` IS EMITTED ON EVERY NON-BLINKING FIELD, and that is a requirement
 * rather than tidiness.** Fields are painted in sequence into one string, so
 * an SGR 5 opened on the `critical` field stays open for every field after it:
 * without this the rate windows, the cost and the audit clock would all blink
 * because the context figure did. Three bytes a field, on a line nobody
 * measures in bytes.
 */
function paint(ink: Ink, bold = false, blink = false): string {
  return `${CSI}${bold ? 1 : 22}m${CSI}${blink ? 5 : 25}m${CSI}38;5;${ink.fg}m`;
}

/**
 * The separator between two fields, painted in the NEUTRAL ink.
 *
 * One colour for every joint, and deliberately not either neighbour's: a rule
 * between two columns belongs to the table rather than to a column, and a
 * separator that took the colour of the field before it would read as part of
 * that field — which is exactly what the powerline arrow did, and it is why a
 * calm bar used to need a second glyph to keep two same-coloured blocks apart.
 * With the ink on the text there is no such case: the separator is dim, the
 * fields are not, and the boundary is visible at every combination of bands.
 */
function joint(): string {
  return `${CSI}22m${CSI}25m${CSI}38;5;${INK.neutral.fg}m${FIELD_JOIN}`;
}

/**
 * Display columns, counted in CODE POINTS rather than UTF-16 units — **and
 * emoji count TWO.**
 *
 * ── WHY THIS GREW A RULE, 2026-09-01 ───────────────────────────────────────
 *
 * Until the level icons this counted every code point as one cell, and its own
 * note said that was deliberate: everything on the line was a model name, a
 * directory basename, a branch name or ASCII, and `SEP` and the caps are one
 * cell each. The four-level treatment breaks that premise by putting emoji on
 * the bar, and the error is not academic — it was MEASURED before the icons
 * were allowed anywhere near a segment:
 *
 *     💀  U+1F480          1 code point   renders 2 cells   undercount 1
 *     🔶  U+1F536          1 code point   renders 2 cells   undercount 1
 *     ⚠️  U+26A0 U+FE0F    2 code points  renders 2 cells   correct, by luck
 *
 * With five bandable fields that is up to five cells of error on one row, and
 * it lands in exactly the two places that must not be wrong: `fitSegments`,
 * which then gives up the wrong block or gives up none and lets the line WRAP,
 * and `centreOffset`, which mis-indents the one-line fallback. Wrapping is
 * named in this file as the one failure this renderer must not have, so the
 * width rule was fixed and tested BEFORE the first icon reached a segment.
 *
 * ── WHAT IT IS AND IS NOT ──────────────────────────────────────────────────
 *
 * Still not a full east-asian-width table, and still deliberately not: this
 * bar draws no CJK and a 40-kilobyte width table would be a runtime dependency
 * in all but name (`CONST-zero-runtime-dependencies`). What it adds is the one
 * class this renderer now actually emits — emoji — by the two ranges that
 * cover every glyph in `LEVEL_ICON` and every neighbour anybody would swap in:
 *
 *   - U+FE0F, the emoji variation selector, is ZERO cells. It is a modifier on
 *     the character before it, not a character. Counting it as one is what
 *     made `⚠️` come out right for the wrong reason, and a rule that is right
 *     by luck stops being right the moment somebody picks a different icon.
 *   - U+1F300–U+1FAFF (the pictograph planes) and U+2600–U+27BF (the older
 *     symbol block `⚠` itself lives in) are TWO cells.
 *
 * The residual inaccuracy is stated rather than hidden: a terminal that
 * ignores U+FE0F renders `⚠️` in ONE cell and this over-counts it by one.
 * Over-counting is the safe direction — it costs at worst one column of the
 * line's width budget, while under-counting costs a wrapped row.
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    // A modifier, not a character. Zero cells of its own.
    if (cp === 0xfe0f) continue;
    if ((cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf)) {
      width += 2;
      continue;
    }
    width += 1;
  }
  return width;
}

export interface RenderOptions {
  /** ANSI escapes, or none at all. */
  colour: boolean;
  /** The terminal's width. `null` fits nothing and lets the line run. */
  columns: number | null;
  /**
   * Whether to indent so the anchor lands on the terminal's centre. Defaults
   * to `true`, which is the ONE-LINE form — the shape the owner's centring
   * ruling was about, and the only shape that has the problem it solves.
   *
   * `renderStatusLine` passes `false`. See its own note for why: on two lines
   * the context figure is already second on a short line beside the ask, and
   * centring line 2 while line 1 has no anchor to centre on would leave the
   * pair with a ragged left edge — two rows that stop reading as one block.
   */
  centre?: boolean;
  /**
   * Whether a `critical` block may carry SGR 5. Defaults to `true`.
   *
   * `false` is what `MYCONTEXT_STATUSLINE_NO_BLINK` reaches (see
   * `statusline.ts` · `NO_BLINK_ENV`), and it costs the bar NOTHING that
   * matters: `critical` is still told from `warning` by its icon, its hue and
   * its bold weight. WCAG 2.2.2 asks that blinking content be stoppable, and
   * this is how it stops.
   */
  blink?: boolean;
}

/**
 * What a row costs in columns.
 *
 * **The arithmetic changed with the frame, and the two changes pull opposite
 * ways.** It used to be two caps, one separator per pair, and every block
 * padded by a space on each side — `sum + 3n + 1`. It is now the fields plus
 * ` │ ` between each pair — `sum + 3n − 3`, which is FOUR columns cheaper per
 * row whatever the field count. Against that, the counts stopped being
 * abbreviated and grew about six columns each. Both were measured rather than
 * traded off on paper; see the lane report for the resulting widths.
 */
/** One field's columns: its name, a space, and its value. */
export function segmentWidth(seg: Segment): number {
  const named = seg.label === undefined ? 0 : displayWidth(seg.label) + 1;
  return named + displayWidth(seg.text);
}

function widthOf(segments: Segment[]): number {
  let total = FIELD_JOIN.length * Math.max(0, segments.length - 1);
  for (const seg of segments) total += segmentWidth(seg);
  return total;
}

/**
 * The blocks that actually fit, in the order the line gives them up.
 *
 * 1. The branch is elided from the LEFT, one code point at a time, down to a
 *    bare `…`. The distinguishing tail is the half worth keeping.
 * 2. Then optional blocks are given up from the LEFT — the disclosures and the
 *    myctx figure before the model, the model before the project — each one
 *    replaced by a single `…` block so a reader can see that something is not
 *    being shown rather than believing the bar is complete.
 * 3. The context block is never given up. If even `▐ ctx 42.0% ▌` will not
 *    fit, the bare text is returned by the caller with no caps at all: an
 *    unwrapped truth beats a decorated one that wraps.
 */
export function fitSegments(segments: Segment[], columns: number | null): Segment[] {
  if (columns === null || columns <= 0) return segments;
  let current = segments.slice();
  if (widthOf(current) <= columns) return current;

  // 1. Elide the branch from the left.
  const branchIndex = current.findIndex((s) => s.elidable === true);
  if (branchIndex >= 0) {
    const branch = current[branchIndex];
    if (branch !== undefined) {
      const points = [...branch.text];
      // The label is not elided with the value: a branch shortened to `…test`
      // still needs to say it is a branch, and the name is three cells against
      // a value that can be forty.
      // `points.length` down to 0 kept: 0 leaves the bare `…`.
      for (let keep = points.length - 1; keep >= 0; keep--) {
        const elided = { ...branch, text: `…${points.slice(points.length - keep).join('')}` };
        current = current.map((s, i) => (i === branchIndex ? elided : s));
        if (widthOf(current) <= columns) return current;
      }
    }
  }

  // 2. Give up optional blocks from the left, leaving an `…` behind.
  while (widthOf(current) > columns) {
    // THE LOWEST-RANKED optional block goes first — `GIVE`, which is the
    // owner's answer to "which would you rather lose", written down once.
    // Neither leftmost nor widest was good enough on its own: leftmost gave
    // up `Opus 5` (8 cells) before the 23-cell project name and arrived at a
    // nearly empty bar with columns unspent, and widest-first would give up
    // a rate-limit window that is about to close to keep a branch name.
    // Width only breaks a TIE, where it buys the most room per block lost.
    let victim = -1;
    let rank = Number.POSITIVE_INFINITY;
    let widest = -1;
    for (let i = 0; i < current.length; i++) {
      const seg = current[i];
      if (seg === undefined || seg.required === true) continue;
      const give = seg.give ?? 0;
      const w = displayWidth(seg.text);
      if (give < rank || (give === rank && w > widest)) { rank = give; widest = w; victim = i; }
    }
    if (victim < 0) break;
    // A mark chosen as the victim is REMOVED rather than replaced by another
    // mark: replacing one with itself changes no width and the loop would
    // never end.
    const dropped = current[victim]?.text === ELLIPSIS_SEGMENT.text ? [] : [ELLIPSIS_SEGMENT];
    current = [...current.slice(0, victim), ...dropped, ...current.slice(victim + 1)];
    // Adjacent marks are one mark. Two `…` blocks in a row say nothing the
    // first does not, and a bar that degrades into a row of them reads as
    // broken rather than as abbreviated — which is the opposite of disclosing.
    // A branch elided all the way down to `…` in step 1 merges here too, so
    // “the branch was shortened” and “something was dropped” cannot double up.
    current = current.filter((seg, i) => !(seg.text === '…' && current[i + 1]?.text === '…'));
  }

  // 3. Nothing optional left and still too wide: the required blocks fall back
  //    to their terse spelling. This is the floor. Below the width of the bare
  //    figure there is nothing left to give that is not the figure itself, and
  //    the figure is never shortened.
  if (widthOf(current) > columns) {
    current = current.map((seg) => (seg.terse === undefined ? seg : { ...seg, text: seg.terse }));
  }

  // 4. **AND BELOW THAT, THE NAMES GO — the last thing given up, and only to
  //    stop the line WRAPPING.**
  //
  // The owner's labels ruling puts a name on every field, and the terse floor
  // is now `WINDOW 42.0%` (12 cells) where it used to be `ctx 42.0%` (9). At a
  // terminal narrower than that the choice is between a row that wraps and a
  // figure with nothing saying what it counts — and wrapping is the one
  // failure this renderer must not have, because it costs the user a row of
  // their transcript on every assistant message.
  //
  // So the name is the LAST thing given up rather than an exception to the
  // ruling: it survives every width at which it fits, and it is dropped only
  // where keeping it would break the guarantee the whole fitter exists for.
  // The FIGURE is still never shortened.
  if (widthOf(current) > columns) {
    current = current.map((seg) => {
      const { label, ...rest } = seg;
      void label;
      return rest;
    });
  }
  return current;
}

/**
 * **HOW FAR THE BAR IS INDENTED SO THE ANCHOR LANDS ON CENTRE** — owner
 * ruling, 2026-08-31, option (a): centre when it fits, left-to-right when it
 * does not.
 *
 * Returns the number of PLAIN SPACES to put before the opening cap, which is
 * `0` whenever the line cannot be centred without pushing its right edge off
 * the terminal. The padding is unpainted and sits outside the bar, so it is
 * blank terminal rather than a stretched block: a bar centred by widening a
 * neutral spacer would read as a block nobody asked for.
 *
 * **Every refusal returns 0, and that IS the ruled fallback.** No width to
 * centre in (`columns === null` — Claude Code's pipe does not always report
 * one), no anchor among the blocks, or a line already as wide as the terminal:
 * in each case the bar starts at column 0 and runs left to right exactly as it
 * did before this ruling. Nothing is dropped to buy the position, which is the
 * half of the ruling the owner was most explicit about — and anything the
 * width DID cost has already been marked by `fitSegments`, which leaves an `…`
 * behind. The layout degrades; the content does not.
 *
 * Computed from the fitted segments and never from the rendered string,
 * because the rendered string carries ANSI escapes and counting cells through
 * them is how an off-by-a-few indent becomes a wrapped line.
 */
export function centreOffset(fitted: Segment[], columns: number | null): number {
  if (columns === null || columns <= 0) return 0;
  const anchor = fitted.findIndex((seg) => seg.anchor === true);
  if (anchor < 0) return 0;
  const total = widthOf(fitted);
  if (total >= columns) return 0;

  // Walk to the anchor in the same units `widthOf` counts: each field's own
  // text, with ` │ ` between neighbours. No caps and no padding since the
  // frame went — and this had to move with `widthOf` or the indent would be
  // computed in one geometry and applied in another.
  let start = 0;
  for (let i = 0; i < anchor; i++) {
    const seg = fitted[i];
    if (seg === undefined) continue;
    start += segmentWidth(seg) + FIELD_JOIN.length;
  }
  const anchorSeg = fitted[anchor];
  if (anchorSeg === undefined) return 0;
  const midpoint = start + segmentWidth(anchorSeg) / 2;

  // Clamped at both ends: never negative (that would be a left crop) and never
  // so far right that the closing cap leaves the terminal (that would wrap,
  // which is the one failure this renderer must not have).
  const wanted = Math.round(columns / 2 - midpoint);
  return Math.max(0, Math.min(wanted, columns - total));
}

/**
 * The finished line.
 *
 * With `colour: false` this emits the SAME TEXT and not one escape byte —
 * never a raw escape into a pipe, and never a different, poorer sentence
 * either. The blocks still read, because every one of them is a word.
 *
 * Indented so the context block lands on the terminal's centre when there is
 * room for it — see `centreOffset`, which is also where the fallback lives.
 */
export function renderPowerline(segments: Segment[], options: RenderOptions): string {
  const fitted = fitSegments(segments, options.columns);
  if (fitted.length === 0) return '';

  const body: string[] = [];
  for (let i = 0; i < fitted.length; i++) {
    const seg = fitted[i];
    if (seg === undefined) continue;
    // Blink is gated three ways and every one of them is a refusal the user
    // can cause: no colour at all, the opt-out, or a field that is not
    // `critical`. A bar rendered without escapes emits no SGR 5 either.
    const blink = seg.blink === true && options.blink !== false;
    // The NAME first and dim, then the value in its own ink. Two paints for
    // one field, which is the whole mechanism: a bright label beside a bright
    // number reads as two numbers.
    if (seg.label !== undefined) {
      if (options.colour) body.push(paint(INK.label));
      body.push(`${seg.label} `);
    }
    if (options.colour) body.push(paint(seg.ink, seg.bold === true, blink));
    body.push(seg.text);
    if (fitted[i + 1] !== undefined) body.push(options.colour ? joint() : FIELD_JOIN);
  }

  // Plain spaces, never painted, so the indent is blank terminal. `''` when
  // there is no room to centre, and `''` throughout the multi-row form, which
  // does not centre at all.
  const indent = options.centre === false
    ? '' : ' '.repeat(centreOffset(fitted, options.columns));

  if (!options.colour) return `${indent}${body.join('')}`;
  // **BOTH RESETS ARE LOAD-BEARING, and they answer the same hazard from two
  // ends.** Claude Code accumulates every SGR from every preceding line and
  // prepends the whole run to each later one (see `renderStatusLine`).
  //
  //   TRAILING — a row that ended mid-colour would paint the row below it, and
  //   with the blink in play would set the whole next row blinking.
  //   LEADING  — the row opens from a known state rather than from whatever
  //   the accumulated run happens to end in. The trailing reset on the row
  //   above already guarantees that today, which makes this one redundant
  //   *given the other* — and that is exactly why it is kept: it makes each
  //   row's own correctness local instead of conditional on its neighbour's.
  //
  // Neither may be "optimised away".
  return `${indent}${RESET}${body.join('')}${RESET}`;
}

/**
 * **THE TWO-LINE STATUS LINE, AND WHAT CLAUDE CODE ACTUALLY DOES WITH IT.**
 *
 * EXTERNAL BEHAVIOUR, marked as such exactly the way `core/statusline-tee.ts`
 * marks its reading of the payload schema — established by READING THE
 * INSTALLED BINARY, not from documentation, and dated because it dates the
 * verification and is not a claim about any other build.
 *
 * Read on 2026-08-31 from the installed `claude` (self-reported `2.1.248`; the
 * session that captured the payload this bar was tuned against reported
 * `2.1.247`). The renderer is two functions and they say everything that
 * matters:
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
 * // and, in the component:
 * //   if (lines.length === 1) -> one <Text dimColor wrap="truncate">
 * //   else -> <Box flexDirection="column">{lines.map(line =>
 * //             <Text dimColor wrap="truncate">{line}</Text>)}</Box>
 * ```
 *
 * Three facts follow, and each one decided something below:
 *
 *  1. **Multi-line is real.** The output is split on `\n` and rendered as a
 *     column, one `Text` per line. Nothing concatenates them.
 *  2. **Each line is truncated INDEPENDENTLY** — `wrap: "truncate"` sits on
 *     every line's own `Text`. The 2.1.80 report of line 2 being truncated as
 *     though it were joined to line 1 cannot happen on this build: there is no
 *     join in this path.
 *  3. **ANSI carries across lines, cumulatively, BY DESIGN.** `H` accumulates
 *     every SGR and OSC-8 escape from every preceding line and prepends the
 *     whole run to each later line. So line 2 does not start clean — it starts
 *     wearing everything line 1 wore.
 *
 * Fact 3 is why each line is rendered with its own `renderPowerline` and
 * therefore its own trailing `RESET`: the accumulated run that gets prepended
 * to line 2 then ENDS in that reset, so the last escape to take effect is a
 * reset and line 2 begins in the default colour. This is not a nicety — with
 * no reset closing line 1, line 2 would open painted in the final block's
 * background, which on a red `crit` context block is a solid red second line.
 * The caller must not "optimise away" the reset at the end of a line.
 *
 * It also means the prepended run costs BYTES on line 2, though not columns:
 * Ink measures display width with the escapes discarded. The width bound this
 * renderer enforces is per line and is unchanged by the prefix.
 */
export function renderStatusLine(lines: Segment[][], options: RenderOptions): string {
  // Empty lines are dropped rather than rendered as a bare pair of caps: a
  // line with nothing on it is not a disclosure, it is a blank row of the
  // user's transcript spent on nothing.
  //
  // **`centre: false`, and it is a judgement the report states rather than
  // hides.** The owner's earlier ruling centred the context figure because it
  // was buried at the right-hand end of a 185-column bar. The two-line ruling
  // dissolves that: line 2 is about a hundred columns and the figure is its
  // SECOND block, immediately beside the ask, in the half of the screen the
  // reader is still watching. Prominence now comes from the grouping, which is
  // what the centring was reaching for. Turning it on here would also indent
  // line 2 while line 1 — which has no anchor — stayed flush left, leaving a
  // ragged edge where the owner's own approved rendering shows two lines
  // starting together. Centring remains live for the one-line fallback, which
  // is the only shape that still has the problem it was ruled for.
  return lines
    .filter((line) => line.length > 0)
    .map((line) => renderPowerline(line, { ...options, centre: false }))
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Whether this line may carry escapes.
 *
 * `NO_COLOR` (any non-empty value) and `TERM=dumb` are refusals, unconditional
 * and first — they are the user saying so.
 *
 * **`isTty` is NOT the whole test, and that is deliberate.** Claude Code runs a
 * `statusLine` command with its stdout on a PIPE and renders the ANSI it gets
 * back; keying colour off `isTty` alone would mean the installed bridge — the
 * only place this line is ever seen — is the one place it is never coloured.
 * `renderer` is how the caller says "the thing reading this pipe understands
 * escapes", and `cmdStatusline` passes `true` for it only after Claude Code's
 * own payload has parsed off stdin. A human piping the command into `grep`
 * gets no payload and is refused before this is reached, so the pipe that gets
 * escapes is always a pipe that asked for them.
 */
export function colourAllowed(
  env: Record<string, string | undefined>,
  isTty: boolean,
  renderer: boolean,
): boolean {
  const noColor = env['NO_COLOR'];
  if (typeof noColor === 'string' && noColor !== '') return false;
  if (env['TERM'] === 'dumb') return false;
  return isTty || renderer;
}

// --- The branch, without running git ----------------------------------------

/**
 * The checked-out branch for `dir`, read from `.git/HEAD`, or `null`.
 *
 * **No subprocess.** This runs once per assistant message, and `git rev-parse`
 * is a process spawn — tens of milliseconds on a cold Windows machine, against
 * a bar whose whole budget is smaller than that. `.git/HEAD` is one small file
 * and the answer is the first line of it.
 *
 * A `.git` that is a FILE rather than a directory is a worktree or a submodule,
 * and it names the real git directory (`gitdir: …`); that indirection is
 * followed once. Anything else — detached HEAD, an unreadable file, no
 * repository above `dir` at all — answers `null`, and the branch block is
 * simply absent. A status line does not diagnose git.
 */
export function gitBranch(dir: string | null): string | null {
  if (dir === null) return null;
  let current = path.resolve(dir);
  for (;;) {
    const head = headFileFor(current);
    if (head !== null) return branchFromHead(head);
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function headFileFor(dir: string): string | null {
  const dotGit = path.join(dir, '.git');
  try {
    if (!existsSync(dotGit)) return null;
    if (statSync(dotGit).isDirectory()) return path.join(dotGit, 'HEAD');
    const pointer = readFileSync(dotGit, 'utf8').trim();
    const match = /^gitdir:\s*(.+)$/.exec(pointer);
    if (match === null || match[1] === undefined) return null;
    return path.resolve(dir, match[1].trim(), 'HEAD');
  } catch {
    return null;
  }
}

function branchFromHead(headFile: string): string | null {
  try {
    const head = readFileSync(headFile, 'utf8').trim();
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
    if (ref !== null && ref[1] !== undefined) return ref[1].trim();
    return null;
  } catch {
    return null;
  }
}
