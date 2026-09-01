import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { UnmeasurableWhy } from '../../core/context-occupancy.ts';
import {
  distinctSessionName, modeFlags,
  type ModelModes, type RateLimit,
} from '../../core/statusline-tee.ts';

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
  /** How far the ask is, in points of the window — `threshold - pct`. */
  askHeadroom: (pct: unknown, threshold: unknown) => number | null;
  CONTEXT_FILL_WARN_PERCENT: number;
  CONTEXT_FILL_CRIT_PERCENT: number;
  CONTEXT_SAMPLE_FRESH_MS: number;
}

async function loadBands(): Promise<BandModule | null> {
  try {
    const mod = (await import(LEVEL_SOURCE)) as Partial<BandModule>;
    if (typeof mod.occupancyLevel !== 'function' || typeof mod.occupancyBands !== 'function'
        || typeof mod.fillLevel !== 'function' || typeof mod.askHeadroom !== 'function') {
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
 * strip draws this distance beside the same gold marker, and a second
 * `threshold - percent` written here would be a second spelling of one number.
 *
 * `null` when the shared module did not load, which is the same degradation
 * every other reader of it takes: the block goes rather than being guessed.
 */
export function headroomFor(percent: number, threshold: number | null): number | null {
  if (BANDS === null) return null;
  const headroom = BANDS.askHeadroom(percent, threshold);
  return typeof headroom === 'number' && Number.isFinite(headroom) ? headroom : null;
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
  /**
   * `--carry` — the web's #8b9ce6, at its nearest 256-colour neighbour.
   *
   * ONE declaration, TWO uses, and that is deliberate. It was already the
   * model block's tint, described here as "`--carry`'s neighbour"; since the
   * owner's ruling of 2026-09-01 it is also the ASK MARKER's, because `gold`
   * moved wholly to the `caution` band (`LEVEL_INK`). Naming it once is what
   * stops the terminal growing two spellings of one web token.
   *
   * Black measures 6.48:1 on it — which clears WCAG AA's 4.5:1, and does NOT
   * clear the 7:1 the three fill hues below clear. Stated with its condition
   * rather than folded into their sentence
   * (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`).
   */
  carry: { bg: 104, fg: 16 },
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
   */
  bold?: boolean;
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
  const glyph = level === null ? LEVEL_GLYPH.neutral : LEVEL_GLYPH[level];
  const figure = `ctx ${occ.percent.toFixed(1)}%`;
  return {
    text: `${glyph} ${figure}`,
    terse: figure,
    ink: inkForLevel(level),
    required: true,
    anchor: true,
    field: 'context',
  };
}

export interface MyctxBlock {
  tokens: number;
  injections: number;
  unrecorded: number;
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
  /** The two windows Claude Code reports, either or both absent. */
  fiveHour: RateLimit | null;
  sevenDay: RateLimit | null;
  /** `cost.total_cost_usd`. */
  costUsd: number | null;
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
  PowerlineInput, 'modes' | 'fiveHour' | 'sevenDay' | 'costUsd' | 'warmPercent' | 'sessionName'
> = {
  modes: { effort: null, thinking: null, fastMode: null, exceeds200k: null },
  fiveHour: null,
  sevenDay: null,
  costUsd: null,
  warmPercent: null,
  sessionName: null,
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
  notes: 80,
  sevenDay: 90,
  fiveHour: 92,
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
  const minutes = Math.floor(Math.max(0, now - then) / 60_000);
  if (minutes < 1) return 'now';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `${days}d${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  return `${mins}m`;
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
      text: 'log — nothing recorded', ink: INK.neutral, give: GIVE.lastAudit, field: 'last-audit',
    };
  }
  if (last.state === 'unreadable') {
    return {
      text: 'log — unreadable', ink: INK.warn, give: GIVE.lastAudit, field: 'last-audit',
    };
  }
  const ago = since(last.at, now);
  if (ago === null) {
    // A stamp this product wrote and cannot parse. Not an age of zero, and not
    // silence either: the row is there and its date is not readable.
    return {
      text: `log ${last.op} — undated`, ink: INK.warn, give: GIVE.lastAudit, field: 'last-audit',
    };
  }
  const fresh = freshMs();
  const stale = fresh !== null && now - Date.parse(last.at) > fresh;
  return {
    text: `log ${last.op} ·${ago}`,
    ink: stale ? INK.warn : INK.neutral,
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
  label: string, limit: RateLimit | null, now: number, give: number, field: string,
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
    field,
  };
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
  // subtracted from either. A fossil with sixty points of head-room is not
  // reassurance, it is a stale claim wearing a plus sign.
  if (level === null || level === 'stale') return null;
  if (level === 'crit') {
    return {
      text: `${ASK_GLYPH} handover due`,
      ink: INK.gold, bold: true, give: GIVE.handoverDue, field: 'ask',
    };
  }
  // The threshold reads as configured — `85`, not `85.0` — while the DISTANCE
  // always carries its decimal, because it is the figure that moves and a gap
  // that shows `+3` for anything from 2.5 to 3.5 hides the last message before
  // the ask.
  const ask = Number.isInteger(threshold) ? String(threshold) : threshold.toFixed(1);
  // **The subtraction is IMPORTED, not repeated.** `askHeadroom` lives in
  // `lib/viewmodel.js` beside `occupancyBands`, and the web strip draws the
  // same distance beside the same gold marker. Two spellings of one arithmetic
  // is how two surfaces come to disagree about one number — the defect this
  // whole file already avoids for the BANDS, applied to the figure they band.
  // `null` only where this function has already returned.
  const headroom = headroomFor(occ.percent, threshold);
  if (headroom === null) return null;
  return {
    text: `${ASK_GLYPH} ask ${ask} · +${headroom.toFixed(1)}`,
    ink: level === 'warn' ? INK.gold : INK.neutral,
    give: GIVE.handoverDue,
    field: 'ask',
  };
}

/** The ask marker. Gold, and never one of the fill glyphs. */
export const ASK_GLYPH = '◆';

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
  return { text, ink: INK.carry, give: GIVE.model, field: 'model' };
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
   * modes, the project, the branch.
   */
  identity: Segment[];
  /**
   * Line 2: everything that moves. The ask scale, the context figure, the two
   * rate-limit windows, the myctx share and the cost — in the owner's order,
   * which puts the ask and the context figure first and adjacent.
   */
  state: Segment[];
}

export function buildLines(input: PowerlineInput, now: number = Date.now()): StatusLines {
  const identity: Segment[] = [];
  const state: Segment[] = [];

  const model = modelSegment(input.model, input.modes);
  if (model !== null) identity.push(model);

  if (input.project !== null && input.project !== '') {
    identity.push({
      text: input.project, ink: INK.project, give: GIVE.project, field: 'project',
    });
  }
  if (input.branch !== null && input.branch !== '') {
    identity.push({
      text: input.branch, ink: INK.branch, elidable: true, give: GIVE.branch, field: 'branch',
    });
  }

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
      text: named, ink: INK.project, give: GIVE.sessionName, field: 'session-name',
    });
  }

  // Focus last on line 1: it is the narrowest thing said there — the tool, the
  // repository, the branch, this window, and finally what this window is FOR.
  if (input.focus !== null && input.focus.trim() !== '') {
    identity.push({
      text: `focus ${focusText(input.focus)}`,
      ink: INK.neutral, give: GIVE.focus, field: 'focus',
    });
  }

  // ── line 2, in the owner's order ──
  // The ask first and the context figure immediately after it: they are one
  // question asked twice — how full, and how far from the ask — and putting a
  // block between them would be read as belonging to neither.
  const ask = askSegment(input.occupancy, input.threshold);
  if (ask !== null) state.push(ask);
  state.push(contextSegment(input.occupancy));

  // **Written as a table so each window's FIELD ID is a `field:` property.**
  // That is the one form `test/ui/strip-parity.test.ts` derives both surfaces'
  // field sets from — an id passed as a bare positional argument would be
  // invisible to it, and a derivation with a blind spot is a hand-kept list
  // wearing a regex. The web strip's `rateLimitParts` is written the same way,
  // with the same two ids.
  for (const w of [
    { field: 'rate-7d', label: '7d', limit: input.sevenDay, give: GIVE.sevenDay },
    { field: 'rate-5h', label: '5h', limit: input.fiveHour, give: GIVE.fiveHour },
  ]) {
    const seg = rateLimitSegment(w.label, w.limit, now, w.give, w.field);
    if (seg !== null) state.push(seg);
  }

  if (input.myctx !== null && input.myctx.injections > 0) {
    const approx = input.myctx.unrecorded > 0 ? '≥' : '';
    state.push({
      text: `myctx ${approx}${fmtK(input.myctx.tokens)}`,
      ink: INK.project,
      give: GIVE.myctxShare,
      field: 'myctx',
    });
  } else if (input.myctxNote !== null) {
    // The SAME field id as the share above, in its absent state — see
    // `Segment.field`. The strip draws exactly this pairing already
    // (`strip.myctx` and `strip.myctxUnavailable`), and a block that explains
    // why a field is missing is not a second field.
    state.push({
      text: `myctx unavailable (${input.myctxNote})`,
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
      ink: INK.project,
      give: GIVE.costCache,
      field: 'cost-cache',
    });
  }

  // Last, and on the line that moves, because it IS a clock. `now` is render
  // time and the age is computed from it here -- never carried in aged.
  const log = lastAuditSegment(input.lastAudit, now);
  if (log !== null) state.push(log);

  return { identity, state };
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
  const { identity, state } = buildLines(input, now);
  return [...identity, ...state];
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

  // Walk to the anchor in the same units `widthOf` counts: one opening cap,
  // then each block as ` text ` with one separator cell between neighbours.
  let start = 1;
  for (let i = 0; i < anchor; i++) {
    const seg = fitted[i];
    if (seg === undefined) continue;
    start += displayWidth(seg.text) + 2 + 1;
  }
  const anchorSeg = fitted[anchor];
  if (anchorSeg === undefined) return 0;
  const midpoint = start + (displayWidth(anchorSeg.text) + 2) / 2;

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
    // Uncapped is the too-narrow floor, where `centreOffset` answers 0 anyway.
    // Not centred, and asserted rather than assumed by the clamp there.
    return options.colour ? `${body.join('')}${RESET}` : body.join('');
  }

  // Plain spaces, outside the caps and never painted, so the indent is blank
  // terminal rather than a block. `''` when there is no room to centre, and
  // `''` throughout the two-line form, which does not centre at all.
  const indent = options.centre === false
    ? '' : ' '.repeat(centreOffset(fitted, options.columns));

  if (!options.colour) return `${indent}${CAP_LEFT}${body.join('')}${CAP_RIGHT}`;
  return (
    `${indent}${RESET}${CSI}38;5;${first.ink.bg}m${CAP_LEFT}` +
    body.join('') +
    `${RESET}${CSI}38;5;${last.ink.bg}m${CAP_RIGHT}${RESET}`
  );
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
