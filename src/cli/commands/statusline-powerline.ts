import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { UnmeasurableWhy } from '../../core/context-occupancy.ts';

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
 * The powerline separator, U+E0B0 — a filled right-pointing triangle in the
 * Nerd Font's private use area, NOT `▶` (U+25B6).
 *
 * The owner's terminal already renders these; the status line installed today
 * proves it. A terminal without the font shows a replacement box here, which
 * is why every block also carries readable text: a missing glyph costs the
 * separator, never the meaning.
 */
export const SEP = '\ue0b0';

/**
 * The THIN separator, U+E0B1 — an outline chevron rather than a filled one.
 *
 * Drawn between two blocks that share a background, where the solid `SEP`
 * would be painted in the colour it sits on and vanish: three green blocks in
 * a row rendered as one long green block with two invisible arrows in it,
 * which is what `7d 49%`, `5h 12%` and `ctx 42.0%` all being 'ok' looks like
 * on a calm day. This is the standard powerline answer to exactly that case,
 * and it keeps the block boundary visible without spending a second hue on it.
 */
export const SEP_THIN = '\ue0b1';

/**
 * The end caps: a RIGHT half block to open, a LEFT half block to close.
 *
 * Painted in the adjacent block's own colour, so each one reads as that block
 * extended by half a cell rather than as a character sitting beside it. They
 * are ordinary Unicode (U+2590, U+258C), not private-use, so they survive a
 * terminal that has no Nerd Font.
 */
export const CAP_LEFT = '▐';
export const CAP_RIGHT = '▌';

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
 * (`test/ui/viewmodel.test.ts` · `A URL specifier is what` · ~42).
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
  CONTEXT_FILL_WARN_PERCENT: number;
  CONTEXT_FILL_CRIT_PERCENT: number;
  CONTEXT_SAMPLE_FRESH_MS: number;
}

async function loadBands(): Promise<BandModule | null> {
  try {
    const mod = (await import(LEVEL_SOURCE)) as Partial<BandModule>;
    if (typeof mod.occupancyLevel !== 'function' || typeof mod.occupancyBands !== 'function'
        || typeof mod.fillLevel !== 'function') {
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
  /** xterm-256 background index. */
  bg: number;
  /** xterm-256 foreground index. */
  fg: number;
}

const INK = {
  /** The model block. `--carry`'s neighbour: this is identity, not a verdict. */
  model: { bg: 104, fg: 16 },
  /** The project block: dark grey, light text. */
  project: { bg: 238, fg: 252 },
  /** The branch block: mid grey. */
  branch: { bg: 244, fg: 16 },
  /** `--ok` — calm. */
  ok: { bg: 115, fg: 16 },
  /** `--warn` — amber, approaching the ask with room to act. */
  warn: { bg: 173, fg: 16 },
  /** `--crit` — the ask fires here. */
  crit: { bg: 174, fg: 16 },
  /**
   * `--gold` — the ask. NOT a fill level: it answers the other question, and
   * it is the hue this project already spends on "your attention is wanted
   * here". No sixth colour is invented for it
   * (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`).
   */
  gold: { bg: 179, fg: 16 },
  /** `--dim` — NOT a level: stale, unmeasurable, or nothing to band against. */
  neutral: { bg: 145, fg: 16 },
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

/**
 * The glyph each level carries, so the hue is never the only carrier.
 *
 * The same four the web strip's chip already uses
 * (`src/ui/public/app.js` · `chip.dataset.g = ` · ~2955): `●` calm, `▲`
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
   */
  bold?: boolean;
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
  | { state: 'known'; percent: number; ageMs: number }
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
      ink: INK.neutral, required: true,
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
      text: `${LEVEL_GLYPH.neutral} ctx — stale`, ink: INK.neutral, required: true,
    };
  }
  const glyph = level === null ? LEVEL_GLYPH.neutral : LEVEL_GLYPH[level];
  const figure = `ctx ${occ.percent.toFixed(1)}%`;
  return {
    text: `${glyph} ${figure}`,
    terse: figure,
    ink: inkForLevel(level),
    required: true,
  };
}

export interface MyctxBlock {
  tokens: number;
  injections: number;
  unrecorded: number;
}

/**
 * One rate-limit window, as Claude Code reports it.
 *
 * Both fields are separately optional because both are separately absent in
 * real payloads: `rate_limits` itself is optional, and a window inside it can
 * arrive with a percentage and no reset, or the reverse. `null` renders
 * nothing rather than a placeholder — a `?` in a block is a claim that
 * something is wrong, and an absent field is not a fault.
 */
export interface RateLimit {
  /** 0–100, as sent. */
  usedPercent: number | null;
  /** UNIX SECONDS, as sent — not milliseconds. Converted once, in `until`. */
  resetsAt: number | null;
}

/**
 * The model's non-default modes, folded into the model block.
 *
 * Every one of these renders ONLY when it is not the ordinary case, so a
 * ordinary session pays zero columns for the whole group. `null` is "the
 * payload did not say", which is treated exactly like the default: this bar
 * does not report the absence of a field, only the presence of a state.
 *
 * **`effort` carries an assumption and it is written down here rather than
 * left in the code.** `thinking`, `fast_mode` and `exceeds_200k_tokens` are
 * booleans whose default is plainly `false`. `effort.level` is a WORD, and
 * this file has no way to observe which word means "unchanged" — it is
 * `'medium'` on every payload read on this machine, so `'medium'` is treated
 * as the default and suppressed. If Claude Code's default moves, the symptom
 * is a block that is always there rather than one that is never there, which
 * is the harmless direction.
 */
export interface ModelModes {
  effort: string | null;
  thinking: boolean | null;
  fastMode: boolean | null;
  exceeds200k: boolean | null;
}

export const DEFAULT_EFFORT = 'medium';

export interface PowerlineInput {
  model: string | null;
  modes: ModelModes;
  project: string | null;
  branch: string | null;
  occupancy: OccupancyView;
  /** `handoverThresholdPercent`, or `null` when the handover feature is off. */
  threshold: number | null;
  /** The two windows Claude Code reports, either or both absent. */
  fiveHour: RateLimit | null;
  sevenDay: RateLimit | null;
  /** `cost.total_cost_usd`. */
  costUsd: number | null;
  /**
   * The share of this turn's input the cache served, DERIVED and not sent:
   * `cache_read_input_tokens` over the input total Claude Code itself
   * displays (`input + cache_creation + cache_read`, the same arithmetic
   * `classifyContext` does for the occupancy). `null` when the payload does
   * not carry the three numbers to derive it from.
   */
  warmPercent: number | null;
  myctx: MyctxBlock | null;
  /** Why the myctx half is MISSING. */
  myctxNote: string | null;
  /** Why the sample did not reach disk. Two facts, two fields — see below. */
  teeNote: string | null;
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
  PowerlineInput, 'modes' | 'fiveHour' | 'sevenDay' | 'costUsd' | 'warmPercent'
> = {
  modes: { effort: null, thinking: null, fastMode: null, exceeds200k: null },
  fiveHour: null,
  sevenDay: null,
  costUsd: null,
  warmPercent: null,
};

export const GIVE = {
  costCache: 10,
  myctxShare: 20,
  project: 30,
  branch: 40,
  model: 50,
  handoverDue: 60,
  notes: 80,
  sevenDay: 90,
  fiveHour: 92,
  mark: 999,
} as const;

function fmtK(n: number): string {
  return `${(n / 1000).toFixed(1)}k`;
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
  const ms = resetsAtSeconds * 1000 - now;
  if (ms < 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'now';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `${days}d${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  return `${mins}m`;
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
  label: string, limit: RateLimit | null, now: number, give: number,
): Segment | null {
  if (limit === null || limit.usedPercent === null || !Number.isFinite(limit.usedPercent)) {
    return null;
  }
  const left = until(limit.resetsAt, now);
  const countdown = left === null ? '' : ` ·${left}`;
  // Age 0: a rate-limit window arrives with the payload that is being read
  // right now, so there is no such thing as a stale one. The `'stale'` branch
  // of `fillLevel` is unreachable from here and is not pretended otherwise.
  const level = absoluteFillLevel(limit.usedPercent, 0);
  const glyph = level === null || level === 'stale' ? LEVEL_GLYPH.neutral : LEVEL_GLYPH[level];
  return {
    text: `${glyph} ${label} ${limit.usedPercent.toFixed(0)}%${countdown}`,
    ink: inkForLevel(level),
    give,
  };
}

/**
 * **HOW CLOSE THE HANDOVER ASK IS** — one gold marker, and the second of the
 * two questions this bar answers.
 *
 * Derived from the threshold exactly as the web strip derives it: `levelFor`
 * is `occupancyLevel`, whose `warn` opens at `threshold * OCCUPANCY_WARN_FRACTION`
 * and whose `crit` IS the threshold. Nothing about the ask is decided here.
 *
 *   below threshold * 0.9   silent — no block at all, no columns spent
 *   approaching             `◆ ask near`
 *   at or past it           `◆ handover due`, bold
 *
 * **Emphasis by WEIGHT and by WORDS, not by a second gold.** The ruling asks
 * for one gold marker in two strengths, and the hue budget is closed
 * (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`), so what
 * separates the two states is a different sentence and a bold weight — both of
 * which survive a mono terminal, a dichromatic reader and forced-colors, where
 * a lighter gold would be the same gold.
 *
 * `null` for a corpus with the handover feature off (no ask, so no distance to
 * it), for an unmeasurable window, and for a fossil: nothing is claimed about
 * proximity to an ask from a reading that is not current.
 */
export function askSegment(occ: OccupancyView, threshold: number | null): Segment | null {
  if (occ.state !== 'known') return null;
  const level = levelFor(occ.percent, threshold, occ.ageMs);
  if (level === 'crit') {
    return {
      text: `${ASK_GLYPH} handover due`, ink: INK.gold, bold: true, give: GIVE.handoverDue,
    };
  }
  if (level === 'warn') {
    return { text: `${ASK_GLYPH} ask near`, ink: INK.gold, give: GIVE.handoverDue };
  }
  return null;
}

/** The ask marker. Gold, and never one of the fill glyphs. */
export const ASK_GLYPH = '◆';

/** The model block, with the modes that are not the ordinary case folded in. */
export function modelSegment(model: string | null, modes: ModelModes): Segment | null {
  const flags: string[] = [];
  if (modes.effort !== null && modes.effort !== '' && modes.effort !== DEFAULT_EFFORT) {
    flags.push(modes.effort);
  }
  // Words, not glyphs alone. A bare `✳` is a hue's problem wearing a
  // different hat: it carries meaning only to a reader who already knows it.
  if (modes.thinking === true) flags.push('think');
  if (modes.fastMode === true) flags.push('fast');
  if (modes.exceeds200k === true) flags.push('200k+');
  const name = model === null || model === '' ? null : model;
  if (name === null && flags.length === 0) return null;
  const text = [name, ...flags].filter((part) => part !== null).join(' ');
  return { text, ink: INK.model, give: GIVE.model };
}

/**
 * The blocks, left to right, before anything is fitted to a width.
 *
 * The four the owner drew are the spine. Everything else appears ONLY when it
 * has something to say, which is what keeps an ordinary session's bar exactly
 * as drawn while a session in trouble grows the blocks that say so:
 *
 *  - `myctx` is what mycontext put into this session, from the injection
 *    records' own frozen estimates. `≥` when some records carry no estimate,
 *    because the true share is at least this and the block says exactly that.
 *  - `myctxNote` and `teeNote` are TWO fields and not one, because folding
 *    them drops whichever did not win: `writeTee` refuses an unsafe
 *    `session_id` while `myctxShare` answers for that same id perfectly well,
 *    so a single note shown only when the share is absent would print a
 *    confident myctx figure and never mention that the web UI is getting
 *    nothing.
 *  - `handover due` is DERIVED from the band and never decided again: `crit`
 *    is `pct >= threshold`, which is the definition of the ask firing. A
 *    second comparison here would be a second chance to disagree with the
 *    strip about whether the ask is live.
 *
 * The context block stays LAST whatever else is present, because the owner's
 * ruling is that the right end of the bar is what shifts as the window fills —
 * a block after it would move the thing the eye is trained on.
 */
export function buildSegments(input: PowerlineInput, now: number = Date.now()): Segment[] {
  const segments: Segment[] = [];

  const model = modelSegment(input.model, input.modes);
  if (model !== null) segments.push(model);

  if (input.project !== null && input.project !== '') {
    segments.push({ text: input.project, ink: INK.project, give: GIVE.project });
  }
  if (input.branch !== null && input.branch !== '') {
    segments.push({ text: input.branch, ink: INK.branch, elidable: true, give: GIVE.branch });
  }

  const ask = askSegment(input.occupancy, input.threshold);
  if (ask !== null) segments.push(ask);

  if (input.myctx !== null && input.myctx.injections > 0) {
    const approx = input.myctx.unrecorded > 0 ? '≥' : '';
    segments.push({
      text: `myctx ${approx}${fmtK(input.myctx.tokens)}`,
      ink: INK.project,
      give: GIVE.myctxShare,
    });
  } else if (input.myctxNote !== null) {
    segments.push({
      text: `myctx unavailable (${input.myctxNote})`, ink: INK.neutral, give: GIVE.notes,
    });
  }
  if (input.teeNote !== null) {
    segments.push({ text: input.teeNote, ink: INK.warn, give: GIVE.notes });
  }

  // Cost and cache in one block: they are one question — what this turn is
  // costing and how much of it the cache is absorbing — and two blocks would
  // spend a separator saying nothing.
  const cost = input.costUsd === null || !Number.isFinite(input.costUsd)
    ? null : `$${input.costUsd.toFixed(2)}`;
  const warm = input.warmPercent === null || !Number.isFinite(input.warmPercent)
    ? null : `warm ${input.warmPercent.toFixed(1)}%`;
  if (cost !== null || warm !== null) {
    segments.push({
      text: [cost, warm].filter((part) => part !== null).join(' · '),
      ink: INK.project,
      give: GIVE.costCache,
    });
  }

  const seven = rateLimitSegment('7d', input.sevenDay, now, GIVE.sevenDay);
  if (seven !== null) segments.push(seven);
  const five = rateLimitSegment('5h', input.fiveHour, now, GIVE.fiveHour);
  if (five !== null) segments.push(five);

  segments.push(contextSegment(input.occupancy));
  return segments;
}

/**
 * Everything this bar reads off Claude Code's payload beyond the model name.
 *
 * EXTERNAL SCHEMA, and read the way `core/statusline-tee.ts` reads one: every
 * field is optional at every level, every wrong type is an absence, and an
 * absence renders NOTHING rather than a placeholder. The set of fields was
 * confirmed present in this machine's own tee captures rather than taken from
 * documentation; `prompt_cache`, `pr`, `vim`, `agent` and `git_worktree` were
 * confirmed ABSENT and are deliberately not read, because a reader written
 * against a field nobody has seen is a reader nothing can test.
 */
export function payloadExtras(payload: unknown): {
  modes: ModelModes;
  fiveHour: RateLimit | null;
  sevenDay: RateLimit | null;
  costUsd: number | null;
  warmPercent: number | null;
} {
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
  const obj = (v: unknown): Record<string, unknown> | null =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;

  const p = obj(payload) ?? {};
  const effortLevel = obj(p['effort'])?.['level'];
  const modes: ModelModes = {
    effort: typeof effortLevel === 'string' ? effortLevel : null,
    thinking: bool(obj(p['thinking'])?.['enabled']),
    fastMode: bool(p['fast_mode']),
    exceeds200k: bool(p['exceeds_200k_tokens']),
  };

  const window = (raw: unknown): RateLimit | null => {
    const w = obj(raw);
    if (w === null) return null;
    const usedPercent = num(w['used_percentage']);
    const resetsAt = num(w['resets_at']);
    return usedPercent === null && resetsAt === null ? null : { usedPercent, resetsAt };
  };
  const limits = obj(p['rate_limits']);

  const usage = obj(obj(p['context_window'])?.['current_usage']);
  const read = num(usage?.['cache_read_input_tokens']);
  const created = num(usage?.['cache_creation_input_tokens']);
  const fresh = num(usage?.['input_tokens']);
  // The denominator is the input total Claude Code itself displays, which is
  // also `classifyContext`'s numerator for the occupancy: one arithmetic, two
  // readers. A zero total is not 0% warm — it is nothing to divide.
  const total = (read ?? 0) + (created ?? 0) + (fresh ?? 0);
  const warmPercent =
    read === null || total <= 0 ? null : (read / total) * 100;

  return {
    modes,
    fiveHour: window(limits?.['five_hour']),
    sevenDay: window(limits?.['seven_day']),
    costUsd: num(obj(p['cost'])?.['total_cost_usd']),
    warmPercent,
  };
}

// --- Rendering --------------------------------------------------------------

const CSI = '\u001b[';
const RESET = `${CSI}0m`;

function paint(ink: Ink, bold = false): string {
  // `22m` and not `0m` to leave bold: a full reset would drop the colours set
  // on the same escape and repaint every following block from scratch.
  return `${CSI}${bold ? 1 : 22}m${CSI}38;5;${ink.fg}m${CSI}48;5;${ink.bg}m`;
}

/** Which separator goes between two blocks — thin when they share a ground. */
export function separatorFor(left: Ink, right: Ink): string {
  return left.bg === right.bg ? SEP_THIN : SEP;
}

/** The separator between two blocks: the LEFT block's colour, on the RIGHT block's. */
function joint(left: Ink, right: Ink): string {
  // A thin separator sits INSIDE one block rather than between two, so it is
  // painted in that block's own foreground on that block's own ground.
  if (left.bg === right.bg) return `${CSI}38;5;${left.fg}m${CSI}48;5;${left.bg}m${SEP_THIN}`;
  return `${CSI}38;5;${left.bg}m${CSI}48;5;${right.bg}m${SEP}`;
}

/**
 * Display columns, counted in CODE POINTS rather than UTF-16 units.
 *
 * Not a full east-asian-width implementation, and deliberately not: everything
 * this renderer puts on the line is a model name, a directory basename, a
 * branch name or its own ASCII, and the two glyphs it adds (`SEP`, the caps)
 * occupy one cell each. What the count must never do is report an astral
 * character as two columns and elide a branch that already fitted.
 */
export function displayWidth(text: string): number {
  return [...text].length;
}

export interface RenderOptions {
  /** ANSI escapes, or none at all. */
  colour: boolean;
  /** The terminal's width. `null` fits nothing and lets the line run. */
  columns: number | null;
}

function widthOf(segments: Segment[]): number {
  // Two caps, one separator between each pair, and each block padded by a
  // space on either side.
  let total = 2 + Math.max(0, segments.length - 1);
  for (const seg of segments) total += displayWidth(seg.text) + 2;
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
  return current;
}

/**
 * The finished line.
 *
 * With `colour: false` this emits the SAME TEXT and not one escape byte —
 * never a raw escape into a pipe, and never a different, poorer sentence
 * either. The blocks still read, because every one of them is a word.
 */
export function renderPowerline(segments: Segment[], options: RenderOptions): string {
  const fitted = fitSegments(segments, options.columns);
  if (fitted.length === 0) return '';

  // The one case the caps are dropped: a terminal too narrow for even the
  // required blocks. Wrapping is the failure this must not have, and the caps
  // are the two cells worth least.
  const capped = options.columns === null || widthOf(fitted) <= options.columns;

  const body: string[] = [];
  for (let i = 0; i < fitted.length; i++) {
    const seg = fitted[i];
    if (seg === undefined) continue;
    const next = fitted[i + 1];
    if (options.colour) body.push(paint(seg.ink, seg.bold === true));
    // The padding is what makes a block a block, and it goes with the caps:
    // once the terminal is too narrow for even the required blocks, four
    // cells of decoration are four cells not spent on the number.
    body.push(capped ? ` ${seg.text} ` : seg.text);
    if (next !== undefined) {
      body.push(options.colour ? joint(seg.ink, next.ink) : separatorFor(seg.ink, next.ink));
    }
  }

  const first = fitted[0];
  const last = fitted[fitted.length - 1];
  if (!capped || first === undefined || last === undefined) {
    return options.colour ? `${body.join('')}${RESET}` : body.join('');
  }

  if (!options.colour) return `${CAP_LEFT}${body.join('')}${CAP_RIGHT}`;
  return (
    `${RESET}${CSI}38;5;${first.ink.bg}m${CAP_LEFT}` +
    body.join('') +
    `${RESET}${CSI}38;5;${last.ink.bg}m${CAP_RIGHT}${RESET}`
  );
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
