import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readAudit } from './audit.ts';
import { handoverAskMuted, type Config, type HandoverConfig } from './config.ts';
import { readOccupancy, type UnmeasurableWhy } from './context-occupancy.ts';
import { sanitizeSessionId } from './ledger.ts';
import { resolveWorkspace } from './workspace.ts';

/**
 * **The rendezvous between an ask and a writing that happen turns apart.**
 *
 * `Stop` asks the model to bring the handover up to date when the context
 * window crosses the configured threshold, and until 2026-08-27 nothing ever
 * checked whether it did. The audit row said an ask went out, which reads
 * exactly like the mechanism worked — and this project has already measured
 * what that costs once, in a neighbouring mechanism: the item held to be the
 * continuity guarantee was delivered on no event at all, for weeks, while
 * everyone believed the guarantee was in force. Nothing said so.
 *
 * `DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is` is the owner's
 * ruling, and its load-bearing sentence is *the flag is not a claim, it is a
 * comparison*. The writer is the MODEL — a handover is prose about what was
 * decided and why, and no hook can produce that — so the two halves are
 * inherently a turn or more apart and no hook timeout could ever contain them.
 * What a hook CAN do is compare two facts it can both observe: when the ask
 * went out, and when the file was last written.
 *
 *     written after the ask  ->  ACTED ON
 *     not written            ->  IGNORED, and that is a fact worth having
 *
 * ── WHY THE LATCH LIVES HERE AND NOT IN `hooks/stop.ts` ────────────────────
 *
 * It was written there, because `Stop` was the only hook that had one. Three
 * events now need it and they need it for three different reasons: `Stop`
 * takes it, `PreCompact` reads it before a compaction destroys the window, and
 * `SessionEnd` with `reason: 'clear'` reads it before a `/clear` does. A latch
 * that three hooks read is a core concern, and leaving it inside a per-turn
 * hook would have made two other hooks import that hook for a file format.
 *
 * ── WHAT IS DELIBERATELY NOT MEASURED ──────────────────────────────────────
 *
 * The file's CONTENT. `readHandover` in `core/handover.ts` parses the document
 * and it is the right tool for delivering it; it is the wrong tool here. This
 * runs on `Stop`, which the platform genuinely waits on before ending a turn,
 * and a `stat` answers the only question being asked — *was it written after we
 * asked* — for the cost of one inode read. Judging the CONTENT would also be a
 * judgement: a model that wrote something this module disliked would be asked
 * again for a document it had just written, which is the loop the latch exists
 * to prevent.
 *
 * ── WHAT THE BUDGET BELONGS TO — `plan:handover seq:10` ────────────────────
 *
 * The latch is stored per SESSION and the ask budget it holds belongs to a
 * WINDOW. Those were the same thing until a compaction, and after one they are
 * not: the session continues with the latch it had, so a session that had spent
 * its asks was never asked about the window the compaction had just refilled —
 * which is the window a handover exists to serve. The owner ruled on 2026-08-29
 * that each rebuilt window gets its own budget.
 *
 * ── WHAT THE BUDGET *IS*, SINCE `plan:handover seq:12` ─────────────────────
 *
 * A count of two asks per window until 2026-09-06, and a PERCENTAGE STEP after
 * it. `askStep` and `AskLatch.askedAtPercent` carry the new rule and the owner's
 * instruction is quoted where the old constant used to be declared. What
 * `resetAsksForWindow` returns is unchanged in kind: whatever arms the next ask,
 * cleared, so the rebuilt window starts from nothing.
 *
 * `resetAsksForWindow` is that ruling, and the window it is handed is the
 * continuity tier's, not one of ours. See its docstring, and `AskLatch.window`.
 */

/**
 * Everything remembered about one session's handover ask. One small JSON file
 * in `state/`, beside the seen file and the restore snapshot — this is where
 * per-session hook state lives, and a second location for eight fields would be
 * a second directory for `mycontext status` and every cleanup path to learn.
 *
 * **`sanitizeSessionId` is `ledger.ts`'s, deliberately, not
 * `statusline-tee.ts`'s.** The two differ in their failure direction: the tee's
 * REFUSES an id it cannot make a filename from (returning `null`), while
 * ledger's FOLDS one, always yielding a name. A refusal here would mean no
 * latch, and no latch means the stand-down line repeats on every turn of that
 * session — the exact noise the latch exists to prevent. It is also the
 * spelling every other file in `state/` already uses, so one session has one
 * name across all of them.
 *
 * **`core/window-state.ts` still does not remove it**, and that is unchanged by
 * this file moving house. A `/clear` destroys a context window and this latch
 * belongs to that window, but adding it to that sweep is a change to what a
 * `/clear` removes — another module's stated contract — and the cost of leaving
 * it is bounded and one-directional: a session that clears and then refills its
 * window after having been asked is asked fewer times, never more.
 */
export interface AskLatch {
  /**
   * The `thresholdPercent` the most recent ask was delivered at, or `null` for
   * a session that has never been asked.
   *
   * The THRESHOLD and not the occupancy, and that is what makes the two edits a
   * user might make mid-session behave differently. Lowering it is somebody
   * saying *ask me sooner than that*, which is a new instruction and is allowed
   * to re-arm; raising it is not a request for anything, and a mechanism that
   * has already spoken must not start again because a number moved away from
   * it. Storing the occupancy instead would re-arm on every higher reading,
   * which is every turn after the first.
   */
  askedAtThreshold: number | null;
  /**
   * The WHOLE PERCENT of occupancy the most recent ask was delivered at — 85
   * for an ask made at 85.1% — or `null` for a window that has never been
   * asked. `plan:handover seq:12`, and the field the owner's instruction of
   * 2026-09-06 turns on.
   *
   * **This is what makes an ask re-arm on progress rather than on a turn
   * passing.** `AskLatch` used to say only THAT it had asked, so `satisfied`
   * silenced the mechanism for the rest of the window: the handover was written
   * once at the threshold and the window then filled for hours with nothing
   * asking again — measured on this corpus at 1h 24m, 2h 39m and 3h 06m of
   * staleness across three consecutive days, every row of them reporting
   * `acted-on`. `acted-on` proves ORDERING, not currency.
   *
   * The WHOLE percent and not the reading, for `askedAtThreshold`'s reason
   * turned the other way round: storing the float would re-arm on every higher
   * reading, which is every turn after the first, and a per-turn hook that
   * repeats is a session that cannot finish. Storing the whole number makes the
   * unit of re-arming a unit of WORK — on a 1M window one percent is roughly ten
   * thousand tokens the current handover does not describe.
   *
   * Written through `askStep`, so it is never above 100 and never a fraction.
   */
  askedAtPercent: number | null;
  /**
   * WALL CLOCK of the most recent ask, ISO-8601, or `null` for a session that
   * has never been asked. The whole of what `plan:handover seq:9` adds here.
   *
   * A wall clock and not a counter, because the other half of the comparison is
   * a file's mtime and that is wall clock too. The cost is the one every mtime
   * comparison has: a clock moved backwards mid-session makes a write look
   * older than the ask that provoked it, and this module reports that as
   * IGNORED. The failure is bounded at one extra ask and one line, and the
   * alternative — believing the ask worked — is the failure this exists to end.
   */
  askedAt: string | null;
  /**
   * How many asks this window has been delivered.
   *
   * **It no longer bounds anything, and that is `seq:12`'s doing.** It was the
   * bound — `MAX_ASKS` was 2 and this field was checked against it — until the
   * owner replaced a count with a progress step; `askedAtPercent` is the bound
   * now, and the ceiling on this number is emergent rather than declared: at
   * most one ask per whole percent from the threshold to 100.
   *
   * It is kept because it is the only field that says HOW MUCH this window was
   * asked, and `resetAsksForWindow`'s audit note reports it — *"(N ask(s) spent
   * in the window this compaction destroyed)"* is a sentence about a count and
   * there is nothing else to compute it from.
   */
  asks: number;
  /**
   * The CONTEXT WINDOW this ask budget belongs to, or `null` for a budget that
   * has never been handed to a window — which is every latch written before
   * `plan:handover seq:10` and every latch in a session that has not yet been
   * compacted.
   *
   * **The value is a compaction snapshot's `capturedAt` and nothing else.** It
   * is not this module's notion of a window and must never become one: the
   * continuity tier already decided what identifies a rebuilt window
   * (`plan:live seq:9` — `core/seen-file.ts`'s `continuityFor`, keyed on
   * `snapshot.capturedAt`, and `core/inject.ts` step 2b), and a second
   * mechanism deciding the same question independently is the two-spellings
   * defect `GateCode`'s docstring argues against and `decay.js` paid for twice
   * in one day. `resetAsksForWindow` therefore takes the marker from its
   * caller, and its only caller is the one hook that has already read that
   * exact snapshot for that exact reason.
   *
   * Compared for EQUALITY, which is `restoredFor`'s comparison and is chosen
   * for `Ledger.recordRestored`'s reason: equality matches "this compaction,
   * fired again" — so a repeated `PostCompact` for one compaction returns the
   * budget once — and stops matching the moment a later compaction writes a
   * different `capturedAt`.
   */
  window: string | null;
  /**
   * Whether the most recent ask has been VERIFIED as acted on.
   *
   * This is the field that changed what the latch meant at `seq:9`. It used to
   * mean "asked"; with that it meant "asked and NOT YET SATISFIED", which is
   * what made a second ask safe: an ask that was ignored can be repeated, and
   * an ask that was answered cannot.
   *
   * **`seq:12` took its gate away and left it its record.** Suppressing until
   * the handover is written is exactly what produced the measured staleness —
   * the ask was answered once at 85% and the window then filled to 99.9% with
   * nothing asking again — so what suppresses now is `askedAtPercent`, and it
   * suppresses only until the next whole percent. This field is still written
   * by the verification on an ask turn, and it is still what
   * `resetAsksForWindow` clears, so the latch on disk still says whether the
   * ask it names was answered.
   *
   * Whether a field that no longer gates anything should survive at all is a
   * real question and it is deliberately NOT answered here: three hooks read
   * this file format and `resetAsksForWindow` names this field in its contract,
   * so removing it is a change to two things the owner's instruction did not
   * rule on. Reported, not taken.
   */
  satisfied: boolean;
  /** Whether the occupancy stand-down line has already been shown this session. */
  stoodDown: boolean;
  /**
   * Whether an ignored ask has already been disclosed on stderr this session.
   *
   * A session can be compacted more than once, and each compaction destroys a
   * window, so each is a real and separate loss — the argument for saying it
   * again is genuine. It is still said only once, for the reason `stoodDown`
   * is: this product's standing choice is silence wherever it has one, and a
   * paragraph the user has already read and already declined to act on teaches
   * nothing the second time. The audit row carries every occurrence, which is
   * the channel that is supposed to be exhaustive.
   */
  disclosedIgnored: boolean;
}

/**
 * The highest whole percent an ask can be earned at. A window is full at 100
 * and there is nothing above it to make progress into.
 *
 * It is a CLAMP and not a refusal: an occupancy reading of 101.4 is a window
 * that is full, not a reading to throw away, and folding it onto 100 is what
 * keeps the number of asks bounded whatever arithmetic the platform sends. The
 * alternative — trusting the reading — would let a bad divisor turn a bounded
 * mechanism into one that asks on every turn forever.
 */
export const ASK_CEILING_PERCENT = 100;

/**
 * **The whole percent an ask at this occupancy belongs to**, or `null` for a
 * reading that is not a number at all. This replaces `MAX_ASKS`.
 *
 * ── THE INSTRUCTION IT IMPLEMENTS, VERBATIM (owner, 2026-09-06) ────────────
 *
 * > *"when handover file is triggerd at 85%, every change up till the context
 * > window is 100% occupy, i mean when the percentage increasing by 1%, you
 * > should always trigger the handover update to stay as much updated as we
 * > could before compaction or new session start."*
 *
 * ── WHY THIS REPLACES THE COUNT RATHER THAN RAISING IT ─────────────────────
 *
 * `MAX_ASKS` was 2 and it existed to stop NAGGING: two asks and then silence,
 * because *a third would be nagging, and a hook that nags is a hook that gets
 * uninstalled* (`DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is`).
 * That argument is about asking again about the SAME STATE, and it still holds
 * — the same whole percent is asked at once and never twice.
 *
 * A percentage step is not the same state. On a 1M window one percent is
 * roughly ten thousand tokens of work the standing handover does not describe,
 * so an ask at 86 is a different ask from the one at 85 and it is earned by
 * that work rather than by a turn having passed. The bound is therefore still a
 * bound and still small: from a threshold of 85 it is fifteen further asks to
 * 100, from the default 98 it is two, and no session can produce more than
 * `100 - threshold` of them per window however long it runs.
 *
 * `Math.floor`, so 85.1 and 85.9 are one step and not two; percentages arrive
 * as floats and the owner's unit is the whole number. `null` for a non-finite
 * reading, which nothing observed produces — `classifyContext` divides by a
 * window size it has already checked is above zero — and which must not be
 * allowed to mean "a step nobody has asked at yet" if it ever does: that would
 * be an ask on every turn, the one failure this mechanism cannot ship.
 */
export function askStep(percent: number): number | null {
  if (!Number.isFinite(percent)) return null;
  return Math.min(ASK_CEILING_PERCENT, Math.floor(percent));
}

export const NO_LATCH: AskLatch = {
  askedAtThreshold: null,
  askedAtPercent: null,
  askedAt: null,
  asks: 0,
  window: null,
  satisfied: false,
  stoodDown: false,
  disclosedIgnored: false,
};

/**
 * The filename suffix every latch in `state/` carries.
 *
 * A CONSTANT rather than a literal in `latchPath`, because there is now a
 * second reader that finds latches by NAME instead of by session id
 * (`lastRecordedAsk`), and the two spellings drifting apart would not fail:
 * the finder would simply stop finding anything, and a mechanism that reports
 * "no ask was ever recorded" about a corpus full of them is the reassuring
 * wrong answer this file argues against everywhere else.
 */
export const ASK_LATCH_SUFFIX = '.handover-ask.json';

export function latchPath(root: string, sessionId: string): string {
  return path.join(root, 'state', `${sanitizeSessionId(sessionId)}${ASK_LATCH_SUFFIX}`);
}

/**
 * The latch as it stands, or `NO_LATCH` for anything that cannot be read.
 *
 * A latch that cannot be READ reads as "nothing has happened yet" — but that
 * alone would be the loop, so it is only half the rule. The other half is in
 * `Stop`: nothing is ever asked unless the latch was successfully WRITTEN
 * first. An unreadable-and-unwritable latch therefore produces silence, not
 * repetition, which is the direction this design cannot afford to get wrong.
 *
 * **`asks` is inferred rather than defaulted to 0 for a latch that predates
 * it.** A file written by the build before `seq:9` carries `askedAtThreshold`
 * and no `asks`, and reading that as zero would hand a session that has already
 * been asked a full budget of two more. One ask is what such a file records, so
 * one ask is what it is read as — the same absent-is-not-zero rule the audit
 * fields keep, in the direction that costs nothing: the worst case is one ask
 * fewer, which is the direction this design chooses everywhere it has a choice.
 */
export function readLatch(root: string, sessionId: string): AskLatch {
  try {
    const raw = JSON.parse(readFileSync(latchPath(root, sessionId), 'utf8')) as unknown;
    if (raw === null || typeof raw !== 'object') return NO_LATCH;
    const value = raw as Record<string, unknown>;
    const askedAtThreshold = typeof value.askedAtThreshold === 'number'
      ? value.askedAtThreshold
      : null;
    return {
      askedAtThreshold,
      // Absent-is-not-zero again, and again resolved in the direction that
      // costs an ask rather than spends one. A latch written before `seq:12`
      // carries a threshold and no percent, and reading that as `null` would
      // say "this window has never been asked" about a window that has — so
      // the next `Stop` would ask immediately, on no progress at all. The
      // threshold it was asked at is the lowest percent it can have been asked
      // at (`Stop` gate 4 is `>=`), so that is what it is read as: the worst
      // case is one ask fewer, at the one upgrade boundary this can happen at.
      askedAtPercent: typeof value.askedAtPercent === 'number'
          && Number.isFinite(value.askedAtPercent)
        ? askStep(value.askedAtPercent)
        : (askedAtThreshold === null ? null : askStep(askedAtThreshold)),
      askedAt: typeof value.askedAt === 'string' && value.askedAt !== '' ? value.askedAt : null,
      asks: typeof value.asks === 'number' && Number.isFinite(value.asks)
        ? value.asks
        : (askedAtThreshold === null ? 0 : 1),
      // An absent or empty `window` is `null`, and `null` is read as "this
      // budget has not been handed to a window yet" — never as a window whose
      // marker happens to be missing. A latch written before `seq:10` lands
      // here, and the first compaction after it sees `null !== capturedAt` and
      // returns the budget once, which is exactly right for a session whose
      // window really was rebuilt while nothing was recording windows.
      window: typeof value.window === 'string' && value.window !== '' ? value.window : null,
      satisfied: value.satisfied === true,
      stoodDown: value.stoodDown === true,
      disclosedIgnored: value.disclosedIgnored === true,
    };
  } catch {
    return NO_LATCH;
  }
}

/**
 * Writes the latch, and says whether it went. `false` means the caller must
 * stay silent: the thing that would stop it repeating did not persist.
 *
 * A plain `writeFileSync`, not the atomic write-and-rename `ledger.ts` uses for
 * the restore snapshot. The trade is different in both directions: this file is
 * eight small fields written by one process per turn, so a torn write costs one
 * re-ask or one re-disclosure, while the snapshot is a whole context window
 * whose loss is unrecoverable. And `Stop` is the hook with the tightest timeout
 * of the ten, so a rename retry budget measured in seconds is a budget it does
 * not have.
 */
export function writeLatch(root: string, sessionId: string, latch: AskLatch): boolean {
  try {
    const file = latchPath(root, sessionId);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(latch), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * What became of one attempt to hand the ask budget to a rebuilt window.
 *
 *  - `nothing-asked` — this session has never been asked, so there is no budget
 *                      to return and nothing is written. The ordinary case, and
 *                      the reason a workspace that never crosses the threshold
 *                      still writes no latch file at all.
 *  - `same-window`   — the budget already belongs to this window. A repeated
 *                      `PostCompact` for one compaction, which must return the
 *                      budget ONCE, not once per firing.
 *  - `no-identity`   — the compaction left no snapshot, so the rebuilt window
 *                      cannot be told from the one before it. The budget stands.
 *  - `reset`         — the budget was returned. The new window is armed from
 *                      nothing, so its first step earns its first ask.
 *  - `unwritable`    — the latch would not persist, so the budget stands. A
 *                      reset that cannot record itself is a reset that happens
 *                      again on the next firing, which is `writeLatch`'s rule.
 */
export type AskWindowResetVerdict =
  | 'nothing-asked' | 'same-window' | 'no-identity' | 'reset' | 'unwritable';

export interface AskWindowReset {
  verdict: AskWindowResetVerdict;
  /** The window marker as given, or `null` when the compaction had no identity. */
  window: string | null;
  /** One clause for an audit note, or `''` when nothing happened and nothing was owed. */
  note: string;
}

/**
 * **Hand the ask budget to a rebuilt context window.** `plan:handover seq:10`,
 * the owner's ruling of 2026-08-29: the ask is a per-WINDOW obligation, not a
 * per-session courtesy.
 *
 * The defect it closes: the budget was bounded per session (`MAX_ASKS` was 2,
 * and since `seq:12` it is a percentage step) while the latch lives with the
 * SESSION, so a session that had spent its asks was never asked again —
 * including about the window a compaction had just refilled, which is precisely
 * the window a handover exists to serve.
 *
 * ── WHERE THE WINDOW COMES FROM, AND WHY IT IS NOT DECIDED HERE ────────────
 *
 * `window` is a compaction snapshot's `capturedAt`, passed in by the caller.
 * That is not a convenience: `plan:live seq:9` already established what
 * identifies a rebuilt window and built the continuity tier on it —
 * `continuityFor(seen, snapshot.capturedAt)` in `core/seen-file.ts`, fed by
 * `core/inject.ts` step 2b. Deciding it a second time here would be two
 * mechanisms independently answering *what is a new window*, which is the
 * two-spellings defect this codebase has met repeatedly and which drifts
 * silently by construction. So this function derives nothing. Its only caller
 * is `hooks/post-compact.ts`, which has already read that snapshot — for
 * `restoredFor`, the sibling comparison — and passes the same field off the
 * same object.
 *
 * ── A COMPACTION WITH NO SNAPSHOT ──────────────────────────────────────────
 *
 * `window === null` means `PreCompact` never wrote a snapshot, so there is no
 * identity at all — the same case `inject.ts` names at step 2b. Continuity
 * answers it by OVER-DELIVERING, and this answers it by asking FEWER times, and
 * the two are the same decision applied to opposite costs. Continuity's failure
 * is a session that starts over with nothing, so it re-sends; the ask's failure
 * is a hook that nags, and *a hook that nags is a hook that gets uninstalled*
 * (`askStep`). Resetting without identity would also be unbounded in a way
 * resetting with it is not: with a marker the reset is idempotent per
 * compaction, and without one nothing could tell a second firing from a second
 * window. This module already states its tie-break — *the worst case is one ask
 * fewer, which is the direction this design chooses everywhere it has a choice*
 * (`readLatch`) — and this is that rule, not a new one.
 *
 * ── WHAT IS RETURNED AND WHAT IS DELIBERATELY KEPT ─────────────────────────
 *
 * Returned: `asks`, `askedAtThreshold`, `askedAtPercent`, `askedAt` and
 * `satisfied` — the whole arming state, because leaving any of them would leave
 * the new window unable to be asked. `askedAtPercent` alone would silence it
 * up to the percent the destroyed window reached (gate 5 in `hooks/stop.ts`),
 * and a surviving `askedAtThreshold` would make the new window's first ask a
 * REPEAT that names an ask belonging to a window that no longer exists.
 *
 * Kept: `stoodDown` and `disclosedIgnored`. Both are once-per-session silences
 * with their own recorded reasoning on their own fields, and neither is what
 * the owner ruled on. `disclosedIgnored` says so outright — a compaction is a
 * genuine argument for repeating the line, and the latch wins anyway. Returning
 * them here would reopen two decisions under cover of a third.
 *
 * The verdict for the ask itself is not touched and cannot be: nothing here
 * reads or writes `HandoverAskVerdict`, so `off`, `not-asked`, `acted-on`,
 * `ignored` and `unverifiable` keep their meanings exactly. `PreCompact` has
 * already judged and disclosed the destroyed window's ask by the time this
 * runs — that is the whole of `seq:9` — so nothing this clears is unrecorded.
 *
 * ── WHAT IT COSTS, MEASURED ────────────────────────────────────────────────
 *
 * Nothing at all on `Stop`. The reset runs on `PostCompact` and on no other
 * event, so the per-turn hook — the one with the real budget, and the one whose
 * gate ladder is ordered by cost — gains no work: `hooks/stop.ts` is unchanged
 * by `seq:10` except that `readLatch` now parses one more field.
 *
 * On `PostCompact`, 2026-08-29, dev machine, two runs of 4,000 iterations
 * against a `%TEMP%` workspace on NTFS:
 *
 *     nothing-asked (no latch file)   median 0.018-0.022 ms   p95 0.022-0.026
 *     same-window   (read only)       median 0.243-0.251 ms   p95 0.32-0.60
 *     no-identity   (read only)       median 0.251-0.272 ms   p95 0.38-1.34
 *     reset         (read + write)    median 0.249-0.285 ms   p95 0.37-1.24
 *
 * The commonest outcome by a wide margin is the cheapest: a workspace with no
 * `handover` key has no latch file, and reading a file that is not there is the
 * 0.02 ms line — the same band as the ask check itself. The whole hook it sits
 * inside measures 2.1-2.4 ms median and 3.9-4.1 ms p95 end-to-end over a 64 KB
 * summary, unchanged inside the noise of the baseline `post-compact-latency
 * .perf.ts` records (p95 3.2-5.3 ms), against that suite's 50 ms ceiling and the
 * manifest's 5,000 ms timeout.
 *
 * Never throws: `readLatch` and `writeLatch` swallow every filesystem outcome
 * and this function does nothing else. `INV-hooks-fail-open`.
 */
/**
 * Whether a latch carries nothing at all — which is what `readLatch` returns
 * for an absent file and for an unreadable one alike. Written as a comparison
 * against `NO_LATCH` rather than a field list so an eighth field cannot be
 * forgotten here: this is the only place that asks the question.
 */
function isPristine(latch: AskLatch): boolean {
  return (Object.keys(NO_LATCH) as (keyof AskLatch)[]).every((key) => latch[key] === NO_LATCH[key]);
}

export function resetAsksForWindow(
  root: string, sessionId: string, window: string | null,
): AskWindowReset {
  const latch = readLatch(root, sessionId);

  // Nothing has ever been asked, so there is no budget to return. Checked
  // FIRST, and it is what keeps `state/` exactly as clean as it is today: a
  // workspace with no `handover` key, or one that never crosses the threshold,
  // has no latch file and must not acquire one because it was compacted.
  if (latch.asks === 0 && latch.askedAt === null && latch.askedAtThreshold === null
    && latch.askedAtPercent === null) {
    // The stamp is still brought forward, so that `window` always names the
    // window the latch's state belongs to and `same-window` above means what it
    // says. Without it, a compaction that found nothing to return would leave a
    // STALE marker, and a repeat firing of that same compaction — after an ask
    // had since been made — would read as a new window and hand back a budget
    // this window had already begun to spend. That is a third ask arriving by
    // another door, and the bound is the thing this mechanism cannot lose.
    //
    // Only when a latch already exists: `writeLatch` would CREATE one, and a
    // file per session in every workspace that never asks is the cost the check
    // above exists to avoid. A pristine latch is either an absent file or an
    // unreadable one, and both mean the session has no state to keep current.
    if (window !== null && latch.window !== window && !isPristine(latch)) {
      writeLatch(root, sessionId, { ...latch, window });
    }
    return { verdict: 'nothing-asked', window, note: '' };
  }

  // EQUALITY, `restoredFor`'s comparison: this is "the same compaction, fired
  // again", and the budget is returned once per compaction, not once per event.
  if (window !== null && latch.window === window) {
    return { verdict: 'same-window', window, note: '' };
  }

  if (window === null) {
    return {
      verdict: 'no-identity',
      window: null,
      note: 'the handover ask budget was NOT returned: this compaction left no snapshot, so ' +
        'the rebuilt window has no identity to hand it to',
    };
  }

  const next: AskLatch = {
    ...latch,
    askedAtThreshold: null,
    // Returned with the rest of the arming state, and it is the field that
    // MATTERS now: leaving it would hand the rebuilt window a latch saying it
    // had already been asked at 99, and nothing below 100 would ever earn a
    // step again — the new window, the one a handover exists to serve, would be
    // silent for exactly the reason `seq:12` exists to end.
    askedAtPercent: null,
    askedAt: null,
    asks: 0,
    window,
    satisfied: false,
  };
  if (!writeLatch(root, sessionId, next)) {
    return {
      verdict: 'unwritable',
      window,
      note: 'the handover ask budget was NOT returned: the latch would not be written, so the ' +
        'spent asks stand for this window too',
    };
  }
  return {
    verdict: 'reset',
    window,
    note: `the handover ask budget was returned for the window captured at ${window} ` +
      `(${latch.asks} ask(s) spent in the window this compaction destroyed)`,
  };
}

/**
 * What became of a handover ask. Five values, and the two in the middle are the
 * whole point of the feature.
 *
 *  - `off`          — no `handover` key. Nothing was promised and nothing asked.
 *  - `not-asked`    — configured, but this session never crossed the threshold.
 *  - `acted-on`     — asked, and the file was written after the ask.
 *  - `ignored`      — asked, and it was not. The silence this feature answers.
 *  - `unverifiable` — asked, and the comparison could not be made. Never
 *                     collapsed into `ignored`: an accusation nothing supports
 *                     is the same defect as a guarantee nothing supports.
 *
 * `off` and `not-asked` are kept apart for the reason that keeps
 * `handoverState`'s `off` apart from `missing` on the `post-compact` row: one
 * means nobody configured this, the other means somebody did and the moment
 * never came. Collapsing them would make the log unable to answer *was this
 * feature ever actually exercised*.
 */
export type HandoverAskVerdict = 'off' | 'not-asked' | 'acted-on' | 'ignored' | 'unverifiable';

export interface HandoverAskCheck {
  verdict: HandoverAskVerdict;
  /** The path AS CONFIGURED, repo-relative, or `null` when the feature is off. */
  path: string | null;
  /** When the ask went out, ISO-8601, or `null` when none has. */
  askedAt: string | null;
  /** When the handover was last written, ISO-8601, or `null` when that is not known. */
  writtenAt: string | null;
  /** One clause for an audit note. Never empty, for any verdict. */
  note: string;
}

/**
 * **The comparison.** Never throws, for any filesystem outcome.
 *
 * `root` is the `.my_context` DIRECTORY — the latch hangs off it — and the
 * handover is resolved against its PARENT, because `handover.path` is validated
 * repo-relative. `core/handover.ts` documents at length why that distinction is
 * a trap worth naming: resolving a repo-relative path against `.my_context/`
 * reports every configured handover in the world as missing, and `missing` is
 * the value that means a broken agreement. Here the same mistake would report
 * every ask as IGNORED — a loud, plausible, permanent lie. The parent is taken
 * once, here, so no caller can get it wrong.
 *
 * **`statSync`, not `readHandover`.** One inode read answers the only question
 * asked. See this module's header for why the content is deliberately not
 * judged.
 *
 * **Strictly `>`.** A file whose mtime equals the ask to the millisecond was
 * not written in response to it — the ask is delivered at the END of a turn and
 * the writing happens in the next one, so a real response is milliseconds to
 * minutes later, never simultaneous. The failure directions are asymmetric and
 * this is the cheaper one: a false `ignored` costs one extra ask and one line;
 * a false `acted-on` is the belief this whole mechanism exists to replace.
 *
 * **A MISSING file is `ignored`, not `unverifiable`.** There is no ambiguity to
 * respect: the model was asked to update a named document and the document is
 * not there, so it certainly was not written. `unverifiable` is reserved for a
 * comparison that genuinely could not be made — an unreadable directory, a
 * permission error, a latch whose timestamp will not parse.
 */
export function checkHandoverAsk(
  root: string, handover: HandoverConfig | null, sessionId: string,
): HandoverAskCheck {
  if (handover === null) {
    return {
      verdict: 'off',
      path: null,
      askedAt: null,
      writtenAt: null,
      note: 'no handover is configured, so none was ever asked for',
    };
  }

  const latch = readLatch(root, sessionId);
  if (latch.askedAt === null) {
    return {
      verdict: 'not-asked',
      path: handover.path,
      askedAt: null,
      writtenAt: null,
      // **The verdict is unchanged by a MUTED ask and the NOTE is not**
      // (`plan:handover seq:11`). `not-asked` is still exactly true — no ask
      // went out — and widening `HandoverAskVerdict` for the mute would put a
      // sixth value into five call sites for a fact none of them decides, which
      // is the shape `seq:14` already refused once. What the mute does change is
      // what a reader should expect NEXT: with a threshold, the silence is a
      // not-yet; with `"never"`, no automatic ask is coming and only a person
      // typing the command will produce one. That is a clause, and a clause is
      // what this field is for.
      note: handoverAskMuted(handover)
        ? `${handover.path} is configured but this session was never asked to update it, and `
          + 'the automatic ask is muted (handover.thresholdPercent: "never") — it will be asked '
          + 'for only on demand'
        : `${handover.path} is configured but this session was never asked to update it`,
    };
  }

  const askedMs = Date.parse(latch.askedAt);
  if (!Number.isFinite(askedMs)) {
    return {
      verdict: 'unverifiable',
      path: handover.path,
      askedAt: latch.askedAt,
      writtenAt: null,
      note: `an ask for ${handover.path} was recorded but its timestamp (${latch.askedAt}) ` +
        'will not parse, so nothing could be compared against it',
    };
  }

  let writtenMs: number | null = null;
  try {
    // `throwIfNoEntry: false` so an absent file is a VALUE rather than an
    // exception: it is the commonest shape of an ignored ask and it is not an
    // error. A DIRECTORY at the configured path is folded in with it, the way
    // `readHandover` folds it into `missing` — there is no handover there
    // either way, and its mtime would answer a question nobody asked.
    const stat = statSync(path.resolve(path.dirname(root), handover.path), {
      throwIfNoEntry: false,
    });
    if (stat !== undefined && stat.isFile()) writtenMs = stat.mtimeMs;
  } catch (err) {
    return {
      verdict: 'unverifiable',
      path: handover.path,
      askedAt: latch.askedAt,
      writtenAt: null,
      note: `an ask for ${handover.path} was recorded at ${latch.askedAt} but the file could ` +
        `not be examined (${err instanceof Error ? err.message : String(err)}), so whether it ` +
        'was acted on is not known',
    };
  }

  if (writtenMs === null) {
    return {
      verdict: 'ignored',
      path: handover.path,
      askedAt: latch.askedAt,
      writtenAt: null,
      note: `the handover ${handover.path} was asked for at ${latch.askedAt} and does not ` +
        'exist — the ask was not acted on',
    };
  }

  const writtenAt = new Date(writtenMs).toISOString();
  return writtenMs > askedMs
    ? {
        verdict: 'acted-on',
        path: handover.path,
        askedAt: latch.askedAt,
        writtenAt,
        note: `the handover ${handover.path} was written at ${writtenAt}, after the ask at ` +
          `${latch.askedAt}`,
      }
    : {
        verdict: 'ignored',
        path: handover.path,
        askedAt: latch.askedAt,
        writtenAt,
        note: `the handover ${handover.path} was asked for at ${latch.askedAt} and has not ` +
          `been written since (last written ${writtenAt}) — the ask was not acted on`,
      };
}

/**
 * The one line a user sees when an ask went unanswered and the window is about
 * to be destroyed. `occasion` names what is destroying it, in words a user
 * recognises.
 *
 * **This is the exception `pre-compact.ts` argues against everywhere else.**
 * That hook deliberately does NOT write the occupancy stand-down line, because
 * a compaction is the one moment where an unsolicited paragraph of ours
 * competes with Claude Code's own compaction notice for a user who asked for
 * neither. This line is a different kind of thing and the difference is the
 * whole justification: the stand-down asks the user to go and install
 * something, while this reports that a thing the product said it would do did
 * not happen, at the last moment where knowing still helps. One line, one
 * verdict, and only for `ignored` — `acted-on` is the mechanism working and
 * needs no announcement.
 */
export function ignoredAskLine(check: HandoverAskCheck, occasion: string): string {
  return (
    `my_context: ${check.path} was asked for at ${check.askedAt} and has not been written ` +
    `since${check.writtenAt === null ? ' (the file does not exist)' : ''}. This ${occasion} ` +
    'destroys the context window, so whatever was not written down goes with it.\n'
  );
}

/**
 * The line to write, or `''` — the whole of the disclosure decision, in one
 * place, so the two boundaries cannot answer it differently.
 *
 * Only `ignored`, and only ONCE per session across both boundaries. A session
 * can be compacted more than once and each compaction is a real, separate loss,
 * which is a genuine argument for repeating it; the latch wins anyway, for
 * `AskLatch.disclosedIgnored`'s reason. The audit row records every occurrence,
 * so nothing is dropped — it is only said aloud once.
 *
 * **The latch is written BEFORE the line is returned, and the line is withheld
 * when the write fails**, which is `standDownOnce`'s rule and it is the same
 * rule: a disclosure that cannot record having been made is a disclosure that
 * will be made again.
 *
 * Never throws — `writeLatch` swallows every filesystem outcome and this
 * function does nothing else.
 */
export function discloseIgnoredAsk(
  root: string, sessionId: string, check: HandoverAskCheck, occasion: string,
): string {
  if (check.verdict !== 'ignored') return '';
  const latch = readLatch(root, sessionId);
  if (latch.disclosedIgnored) return '';
  if (!writeLatch(root, sessionId, { ...latch, disclosedIgnored: true })) return '';
  return ignoredAskLine(check, occasion);
}

/**
 * The whole resolved configuration for a workspace, or `null` for every reason
 * there is not one. `root` is the `.my_context` directory.
 *
 * **`resolveWorkspace` throws on a `config.json` that is not valid JSON**, and
 * that throw is caught here rather than left to a caller's outer catch. A
 * broken config turns this feature off; it does not stop a hook doing its
 * actual job — `Stop` still writes the row that says where one turn ended and
 * the next began, and `SessionEnd` still clears the window a `/clear`
 * destroyed. That is the same choice `session-end.ts` makes by reaching for
 * `findProjectRoot` rather than `resolveWorkspace`, and this function is how a
 * hook that has already made it can still ask about the handover.
 *
 * `path.dirname(root)` because `resolveWorkspace` takes a directory to search
 * FROM, and `root` is the `.my_context` inside it.
 */
export function workspaceConfigAt(root: string): Config | null {
  try {
    return resolveWorkspace(path.dirname(root)).config;
  } catch {
    return null;
  }
}

/** `workspaceConfigAt`, narrowed to the one key three hooks want out of it. */
export function handoverConfigAt(root: string): HandoverConfig | null {
  return workspaceConfigAt(root)?.handover ?? null;
}

// ─── plan:handover seq:14 — the SAME ask, asked for on demand ───────────────
//
// `DEC-a-handover-can-be-asked-for-on-demand-and-the-ask-is-the`, owner ruling
// 2026-09-06: a person who wants to compact or start a new session before the
// threshold can say so, and what they get is the ask `Stop` already fires, at
// whatever the occupancy currently is.
//
// **Shape (a) — a command that ASKS — and not (b) a sixth verdict.** The
// reported defect is that a handover written by hand at 40% reports
// `not-asked`: `checkHandoverAsk` returns on a null `askedAt` before it ever
// stats the file, so a person who prepared early is told nothing is prepared.
// (b) would have described that fact by widening `HandoverAskVerdict`, which
// five call sites read. (a) closes it by making the missing half exist: fire an
// ask, and every downstream reader — the strip, the watch screen, `PreCompact`,
// `SessionEnd`, `Stop`'s own paragraph chooser — works unchanged, because the
// mechanism only ever knew about asks. `checkHandoverAsk` above is untouched by
// this section, and that is the point of it.
//
// **Three surfaces, one implementation.** A CLI command
// (`cli/commands/handover.ts`) and an MCP tool (`mcp/tools.ts`) both call
// `askHandoverNow` and render what it returns; the slash command
// (`commands/handover.md`) names the CLI. Every decision below — which session
// this is, what the occupancy is, and each of the refusals — happens here,
// once. A surface that re-derived any of it is the drift this project measures
// in days.

/**
 * **One lane this session dispatched that has not been seen to stop.**
 *
 * `agent-dispatched` opens it, `subagent-stop` closes it, and `agent-step`
 * dates it — the three ops `ui/public/screens/watch.js` already joins as
 * `LANE_OPS`, joined here by the same `agent=<id>` key their notes already
 * carry (`core/audit.ts` argues at length why the id rides in `note` rather
 * than in a field of its own). Nothing new is recorded to answer this: the
 * rows are already there.
 */
export interface RunningLane {
  agentId: string;
  /** The agent type the dispatch row named, or `null` when it named none. */
  type: string | null;
  /** The dispatch's own one-line description, or `null` when it carried none. */
  what: string | null;
  /** When the dispatch row was written, ISO-8601. */
  dispatchedAt: string;
  /**
   * The most recent `agent-step` for this lane, ISO-8601, or `null` when no
   * step has been recorded for it yet.
   *
   * `null` is drawn as an em dash and never as a time: an absent last step
   * means nothing has been observed since the dispatch, which is not the same
   * as the lane having last acted at the moment it was dispatched.
   */
  lastStepAt: string | null;
}

/** `agent=<id>`, the one join key all three lane ops embed in their own note. */
const LANE_AGENT = /\bagent=([A-Za-z0-9_]+)/;

/**
 * **What this session has in flight**, oldest dispatch first — or `null` when
 * the audit log could not be read.
 *
 * `null` is not an empty list and the two must never be collapsed:
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` is the whole
 * of it, and here it is load-bearing rather than cosmetic — a caller that read
 * an unreadable log as "nothing is running" would proceed silently through the
 * one gate the owner asked for by name.
 *
 * **Scoped to ONE session, and that is what keeps a fossil out.** A dispatch
 * whose lane died without a `SubagentStop` never gets its closing row and would
 * otherwise read as running forever: this repository's own log carries one such
 * row from 2026-09-04 (`agent=agent_MINE_01`, a hand-made probe). Scoping to
 * the session that is asking drops every fossil belonging to a session that has
 * ended — a lane of the CURRENT session that died mid-flight is still reported,
 * and is reported with the dates that let a person recognise it, rather than
 * with a liveness verdict nobody measured.
 *
 * Never throws. `readAudit` refuses a damaged log rather than skipping the line
 * (`core/audit.ts`), and that refusal lands here as `null`.
 */
export function runningLanes(root: string, sessionId: string): RunningLane[] | null {
  let records;
  try {
    records = readAudit(root);
  } catch {
    return null;
  }
  const open = new Map<string, RunningLane>();
  const stopped = new Set<string>();
  const lastStep = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== 'hook' || record.sessionId !== sessionId) continue;
    const note = record.note ?? '';
    const found = LANE_AGENT.exec(note);
    if (found === null) continue;
    const agentId = found[1];
    if (record.op === 'agent-dispatched') {
      // `dispatched type=<type> agent=<id>: <description>` —
      // `hooks/post-tool-use.ts`. Both halves are read as optional even though
      // the writer supplies both today: a note this cannot parse yields `null`,
      // which the surfaces draw as an em dash, rather than a lane silently
      // dropped from a list whose whole job is to be complete.
      const type = /\btype=(\S+)/.exec(note);
      const key = `agent=${agentId}: `;
      const colon = note.indexOf(key);
      open.set(agentId, {
        agentId,
        type: type === null || type[1] === '<absent>' ? null : type[1],
        what: colon === -1 ? null : note.slice(colon + key.length),
        dispatchedAt: record.at,
        lastStepAt: null,
      });
    } else if (record.op === 'subagent-stop') {
      stopped.add(agentId);
    } else if (record.op === 'agent-step') {
      lastStep.set(agentId, record.at);
    }
  }
  return [...open.values()]
    .filter((lane) => !stopped.has(lane.agentId))
    .map((lane) => ({ ...lane, lastStepAt: lastStep.get(lane.agentId) ?? null }))
    .sort((a, b) => a.dispatchedAt.localeCompare(b.dispatchedAt));
}

/**
 * **Is this running inside a Claude Code session, and which one?** `null` when
 * it is not — and that answer is a REFUSAL, not a problem to solve.
 *
 * Owner ruling 2026-09-06, in as many words: *"another thing we cant do is to
 * allow this action only if it is done from inside claude code app and not
 * elsewere."* The ask tells THE SESSION YOU ARE IN to write its handover, so
 * outside a session there is nothing the request could mean. There is
 * deliberately no `--session <id>` to name one with: an escape hatch would turn
 * the ruling into a suggestion, and a mistyped id succeeds silently against
 * another session's latch.
 *
 * ── WHAT THE SIGNAL IS, AND EXACTLY HOW STRONG IT IS ───────────────────────
 *
 * `CLAUDE_CODE_SESSION_ID`, and it is a STATEMENT by the only party that knows.
 * **Measured, not assumed, on Claude Code 2.1.260** — the build on this
 * machine, `~/.local/share/claude/versions/2.1.260`:
 *
 *  - it is present in the environment of a Bash tool call (observed directly);
 *  - the binary's own stdio-MCP launch path spells the child environment
 *    `{...env, CLAUDE_PROJECT_DIR, CLAUDE_CODE_SESSION_ID: Y(), CLAUDECODE: '1'}`
 *    at two call sites, so a plugin's MCP server is handed it too.
 *
 * So all three surfaces are covered by one signal: the MCP tool has it because
 * the server was started with it, the slash command has it because it runs the
 * CLI through a tool call, and the CLI has it when — and only when — something
 * inside a session started it. A terminal a person opened themselves has
 * nothing, which is the refusal the ruling asks for.
 *
 * **It is not an authentication boundary, and this comment will not pretend
 * otherwise.** An environment variable can be set by hand, and so can the file
 * the check below leans on. What the pair buys is honesty rather than
 * enforcement: `askHandoverNow` requires, on top of this, that the named
 * session have a CURRENT context sample in this corpus's own bridge — a file
 * `mycontext statusline` writes from the payload Claude Code hands it on every
 * assistant message, fresh within `CONTEXT_SAMPLE_FRESH_MS`. Forging that is no
 * longer "export a variable": it is fabricating a live status-line sample for a
 * session id, in this corpus, within the last fifteen minutes. Anyone holding a
 * shell in this repository can still do it, and nothing available here is
 * stronger — Claude Code signs nothing, the MCP transport carries no session
 * identity, and the plugin shares no secret with it. The check stops the case
 * the ruling is about (a command run somewhere it cannot mean anything) and it
 * does not stop a determined forger.
 *
 * **What this deliberately no longer does.** An earlier shape resolved "the
 * live session" by scanning `.my_context/.statusline/` for the one session with
 * a readable sample. That is gone. It was a derivation rather than a guess and
 * it still answered the wrong question: it would have let the command run from
 * a plain terminal whenever exactly one session happened to be warm, which is
 * precisely what the ruling forbids.
 */
export function sessionFromEnvironment(env: Record<string, string | undefined>): string | null {
  const id = env.CLAUDE_CODE_SESSION_ID;
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * What became of one on-demand ask.
 *
 *  - `off`            — no handover is configured, so there is nothing to ask
 *                       for. The same distinction `checkHandoverAsk` draws
 *                       between `off` and `not-asked`: nobody configured this.
 *  - `outside-session` — this is not running inside a Claude Code session, so
 *                       there is no session to ask. Owner ruling 2026-09-06,
 *                       and it is a refusal by DESIGN rather than a failure to
 *                       resolve something: the ask tells the session you are in
 *                       to write its handover, and outside one the request has
 *                       no referent. There is no id to supply instead.
 *  - `no-occupancy`   — the session is known and how full its window is is not.
 *                       The ask stamps `askedAtPercent`, and the whole value of
 *                       `seq:12` is that this number is TRUE — so an occupancy
 *                       that cannot be read is a refusal, never a default to
 *                       the threshold, to zero, or to the last value seen.
 *  - `work-in-flight` — this session has lanes running. Not a verdict on
 *                       whether asking is wise: the owner's ruling of
 *                       2026-09-06 is that the PERSON chooses, so this names
 *                       what is running and stops. `anyway` proceeds past it.
 *  - `work-unknown`   — the audit log could not be read, so whether anything is
 *                       running is UNMEASURED. Refused for the reason a
 *                       measured zero and an unmeasured one are never drawn
 *                       alike: "nothing is running" is a claim, and this one
 *                       could not be made. `anyway` proceeds past it too.
 *  - `unwritable`     — the latch would not persist. `writeLatch`'s standing
 *                       rule, unchanged: an ask that cannot record itself is
 *                       not delivered, because the record is what every reader
 *                       compares against.
 *  - `asked`          — the ask went out. `ask` carries the paragraph.
 */
export type OnDemandAskVerdict =
  | 'off' | 'outside-session' | 'no-occupancy' | 'work-in-flight' | 'work-unknown'
  | 'unwritable' | 'asked';

export interface OnDemandAsk {
  verdict: OnDemandAskVerdict;
  /** The session the ask was made for, or `null` outside a Claude Code session. */
  sessionId: string | null;
  /** The handover AS CONFIGURED, repo-relative, or `null` when the feature is off. */
  path: string | null;
  /**
   * The occupancy the ask was stamped at, or `null` when it could not be read.
   *
   * `null` and not `0`, and no branch below supplies a number it did not
   * measure — `Occupancy` has no `percent` field at all on its unmeasurable
   * branch precisely so that no caller can write `percent ?? 0` and turn
   * "never measured" into "empty".
   */
  percent: number | null;
  /** The whole percent the ask belongs to (`askStep`), or `null` with `percent`. */
  step: number | null;
  /** When the ask went out, ISO-8601, or `null` for every refusal. */
  askedAt: string | null;
  /** Why the occupancy could not be read. Only on `no-occupancy`. */
  why: UnmeasurableWhy | null;
  /** What this session has in flight. Only on `work-in-flight`. */
  running: RunningLane[];
  /** The paragraph the model must act on, or `''` for every refusal. */
  ask: string;
  /** One clause for a human. Never empty, for any verdict. */
  note: string;
}

/**
 * **The paragraph an on-demand ask delivers, and why it is a fourth rather than
 * one of `Stop`'s three.**
 *
 * `hooks/stop.ts` has three, chosen by the verdict on the ask before this one,
 * and every one of them is written for an occasion this is not: a window that
 * has crossed a threshold or grown a percent into one. Read at 41% they are
 * false in their first clause — "before the compaction", "you have this turn" —
 * and a model told something it can see is untrue learns to discount the next
 * thing it is told. So this says the true thing instead: a PERSON asked, the
 * occupancy is whatever it is, and the reason the turn matters is that they are
 * about to end the window on purpose.
 *
 * The occupancy is stated to one decimal exactly as `Stop`'s are, and it is the
 * READING rather than the step, because the step is the latch's unit and the
 * reading is what the person is looking at.
 */
export function onDemandAskText(handoverPath: string, percent: number): string {
  return (
    `Update ${handoverPath} NOW. This was asked for on demand, by the person working with ` +
    `you — not by a threshold: the context window is ${percent.toFixed(1)}% full and they ` +
    'intend to compact or start a new session shortly. Write what you were doing, what you ' +
    'decided and why, and what the next session must do first. You have this turn. Nothing ' +
    'else carries across.'
  );
}

export interface AskHandoverOptions {
  /**
   * The environment `CLAUDE_CODE_SESSION_ID` is read from. Injected so a test
   * pins it rather than inheriting the machine it happens to run on.
   *
   * There is no `sessionId` option beside it, and the absence is the ruling:
   * naming a session by hand is exactly what the owner ruled out on
   * 2026-09-06 — see `sessionFromEnvironment`.
   */
  env?: Record<string, string | undefined>;
  /** Proceed past `work-in-flight` and `work-unknown`. Never past the other refusals. */
  anyway?: boolean;
  /** The instant the ask is stamped at. Injected so a test can pin it. */
  now?: Date;
}

/**
 * **Fire the ask, or say exactly why not.** Never throws, for any filesystem
 * outcome: every call below is already wrapped where it is declared.
 *
 * `root` is the `.my_context` DIRECTORY, the same argument `checkHandoverAsk`
 * takes and for the same reason — the latch hangs off it and the handover is
 * resolved against its parent.
 *
 * **What it deliberately does NOT do.**
 *
 *  - It does not consult the threshold. *At whatever the occupancy currently
 *    is* is the ruling, in as many words, and a threshold gate here would
 *    reinstate the wait the command exists to end.
 *  - **It does not consult the MUTE either, and that is load bearing rather
 *    than incidental** (`plan:handover seq:11`, 2026-09-07). A
 *    `thresholdPercent: "never"` mutes the AUTOMATIC ask — the one `Stop`
 *    makes on its own, on a turn nobody asked about — and this function is the
 *    other kind: a person typed a command. Refusing them here would mean the
 *    mute had removed the only remaining way to get an ask on purpose, which
 *    would make it an off switch for the feature rather than for the nagging,
 *    and that is the switch that already exists (remove the `handover` key).
 *    The gate is in `hooks/stop.ts` and belongs nowhere else; `handoverAskMuted`
 *    is deliberately not called below.
 *  - It does not consult `askedAtPercent`. `Stop`'s progress gate exists to
 *    stop a PER-TURN hook nagging; a person typing a command is not a hook, and
 *    refusing them because the same whole percent was already asked at would be
 *    the mechanism arguing with the only party it serves.
 *  - It does not claim `askedAtThreshold`. That field records the threshold an
 *    ask was DELIVERED AT, and this ask was delivered at no threshold at all —
 *    so it is carried forward untouched, which leaves `Stop`'s
 *    lowered-threshold re-arming reading exactly what it read before.
 *  - It does not stat the handover. That is `checkHandoverAsk`'s question, and
 *    it is asked AFTER an ask exists, which is the whole shape of the fix.
 */
export function askHandoverNow(root: string, options: AskHandoverOptions = {}): OnDemandAsk {
  const base = {
    sessionId: null, path: null, percent: null, step: null, askedAt: null,
    why: null, running: [], ask: '',
  };

  const handover = handoverConfigAt(root);
  if (handover === null) {
    return {
      ...base,
      verdict: 'off',
      note: 'no handover is configured, so there is nothing to ask for — set `handover.path` ' +
        'in .my_context/config.json first',
    };
  }

  // THE RULING, and it is the first gate after the feature switch: this may
  // only be asked from inside a Claude Code session. Not an ambiguity to
  // resolve and not a default to fall back from — outside a session the
  // request has no referent at all.
  const sessionId = sessionFromEnvironment(options.env ?? process.env);
  if (sessionId === null) {
    return {
      ...base,
      verdict: 'outside-session',
      path: handover.path,
      note: 'refused — no Claude Code session. This asks the session you are in to write its ' +
        'handover, so it can only be run from inside Claude Code. Nothing was written',
    };
  }

  const occupancy = readOccupancy(root, sessionId);
  if (occupancy.state !== 'known') {
    return {
      ...base,
      verdict: 'no-occupancy',
      sessionId,
      path: handover.path,
      why: occupancy.why,
      note: `how full ${sessionId}'s context window is could not be read, so the ask ` +
        'has no true percent to stamp. Nothing was asked for, and no number was invented for it',
    };
  }

  // `askStep` and never `Math.round`: the whole percent is the latch's unit and
  // it is decided in one place, so the paragraph and the latch can never
  // disagree about which step this ask belongs to. `null` is a non-finite
  // reading, which nothing observed produces and which must not be allowed to
  // mean "a step nobody has asked at yet".
  const step = askStep(occupancy.percent);
  if (step === null) {
    return {
      ...base,
      verdict: 'no-occupancy',
      sessionId,
      path: handover.path,
      why: 'unknown-shape',
      note: `${sessionId}'s context sample reported a percentage that is not a finite ` +
        'number, so there is no whole percent to stamp the ask at. Nothing was asked for',
    };
  }

  if (options.anyway !== true) {
    const lanes = runningLanes(root, sessionId);
    if (lanes === null) {
      return {
        ...base,
        verdict: 'work-unknown',
        sessionId,
        path: handover.path,
        percent: occupancy.percent,
        step,
        note: 'the audit log could not be read, so whether this session has work in flight is ' +
          'unmeasured — not zero. Nothing was asked for',
      };
    }
    if (lanes.length > 0) {
      return {
        ...base,
        verdict: 'work-in-flight',
        sessionId,
        path: handover.path,
        percent: occupancy.percent,
        step,
        running: lanes,
        note: `${lanes.length} lane(s) this session dispatched are still running. Nothing was ` +
          'asked for: a handover written now describes work that is still moving',
      };
    }
  }

  const latch = readLatch(root, sessionId);
  const askedAt = (options.now ?? new Date()).toISOString();
  // Latched BEFORE the paragraph is returned, and the paragraph is withheld
  // when the write fails — `writeLatch`'s rule, which `Stop` obeys too: an ask
  // the mechanism cannot remember making is an ask nothing can ever report as
  // answered, so the next reading would say `not-asked` about a model that had
  // already been told to write.
  //
  // `askedAtThreshold` is carried forward and NOT set: see the header above.
  // `satisfied` is false because a new ask is a new thing to satisfy, and
  // `asks` counts this one, exactly as `Stop`'s does.
  if (!writeLatch(root, sessionId, {
    ...latch,
    askedAtPercent: step,
    askedAt,
    asks: latch.asks + 1,
    satisfied: false,
  })) {
    return {
      ...base,
      verdict: 'unwritable',
      sessionId,
      path: handover.path,
      percent: occupancy.percent,
      step,
      note: `the ask could not be recorded at ${latchPath(root, sessionId)}, so it was ` +
        'not made: nothing would be able to tell later whether it had been answered',
    };
  }

  return {
    ...base,
    verdict: 'asked',
    sessionId,
    path: handover.path,
    percent: occupancy.percent,
    step,
    askedAt,
    ask: onDemandAskText(handover.path, occupancy.percent),
    // The owner's own shape for the success line: the percent, the path, and
    // what happens next. The STEP and not the reading, because the step is what
    // the latch now holds and therefore what any later reader will find there.
    note: `handover asked at ${step}% — ${handover.path}, and the assistant is asked to write ` +
      `it on its next turn (latch stamped askedAtPercent=${step})`,
  };
}

// --- The READ path: a handover delivered out of a window that has ended ------
//
// `plan:handover seq:17`, owner ruling 2026-09-06. Everything above this line
// belongs to the ASK — the write path, which runs at high occupancy in a
// session with almost no room left. NOTHING BELOW THIS LINE RUNS THERE. It is
// reached from `hooks/session-start.ts` only, once per session, after the
// handover block has already been built, and it adds no obligation of any kind
// to whoever writes the document. That constraint outranks this feature and is
// the reason the split is marked here rather than left to be noticed.
//
// ── WHAT IS MEASURED, AND WHAT IS DELIBERATELY NOT ─────────────────────────
//
// The ruling says the block should state that it is being read into a window
// at a low percentage while it was written at a high one. **The second
// percentage is not measurable at `SessionStart`, and inventing it is the one
// failure this line cannot survive** — a wrong percentage here is worse than no
// sentence, because the sentence would be believed. Measured 2026-09-06 against
// this corpus:
//
//   readOccupancy(root, <a session id that has not been seen before>)
//     -> { state: 'unmeasurable', why: 'no-sample' }
//
// which is EVERY new session: `startup` and `fork` mint an id, and
// `hooks/session-end.ts` records that `/clear` mints one too. The status-line
// bridge writes one sample per assistant message, and at `SessionStart` this
// window has had none.
//
// The `compact` source is worse than unmeasurable and it is worse in the
// direction that lies. It keeps its session id, so the tee IS readable — and
// what it holds is the reading from just before the compaction, stamped seconds
// ago and therefore FRESH by `CONTEXT_SAMPLE_FRESH_MS`. Reading it would report
// the destroyed window's 96% as this window's occupancy and conclude that
// nothing was stale, at the exact moment the warning matters most. That is
// `plan:walk seq:123`'s fossil with a live timestamp, and no freshness gate can
// catch it, because the sample is not old — it is about a different window.
//
// So the read side is not measured at all. It does not need to be: the four
// sources `HANDOVER_SOURCES` admits are, by that constant's own documented
// rule, exactly the ones that ARRIVE WITH AN EMPTY CONTEXT WINDOW — `resume`,
// the one source that keeps its window, is excluded there and never reaches
// this code. "This window has just begun" is therefore a fact of the event
// rather than a reading off a file, which is a stronger claim than any
// percentage would have been.
//
// ── WHY THE ORDERING MAKES THE WRITE PERCENTAGE AVAILABLE AT ALL ───────────
//
// `resetAsksForWindow` nulls `askedAtPercent` after every compaction, so it
// would be reasonable to expect it gone by the time the block is delivered. It
// is not: `hooks/post-compact.ts` records, from a trace of build 2.1.239, that
// `SessionStart(source: 'compact')` fires FIRST and `PostCompact` second on all
// three compaction paths. The latch this reads still carries the destroyed
// window's last ask. On the other three sources the writing session's latch
// survives in `state/` under ITS id — `core/window-state.ts` does not remove it
// — which is what `lastRecordedAsk` goes looking for.

/**
 * One ask, as some session actually recorded it. Both numbers are nullable in
 * `AskLatch` and neither is nullable here: this type exists to be the thing a
 * caller may quote, so a latch that carries half an ask is not one.
 */
export interface RecordedAsk {
  /** The session whose latch holds it. */
  sessionId: string;
  /** ISO-8601, `AskLatch.askedAt` verbatim. */
  askedAt: string;
  /** `AskLatch.askedAtPercent` verbatim — a whole percent, written by `askStep`. */
  askedAtPercent: number;
}

/**
 * **The most recent ask this corpus has a record of**, or `null` when it has
 * none at all.
 *
 * `sessionId`'s own latch is consulted FIRST and wins outright when it carries
 * an ask, because that attribution is certain: the ask and the delivery belong
 * to one session. That is the `compact` path, where the window that wrote the
 * handover and the window reading it are the same session and the latch is
 * still intact (see the note above on hook ordering).
 *
 * Only when it carries none does this scan. `startup`, `clear` and `fork` all
 * mint a new id, so this session's latch is a fresh `NO_LATCH` and the ask that
 * matters is under the previous session's name — a name nothing here knows. The
 * scan is over FILENAMES in `state/`, matched on `ASK_LATCH_SUFFIX`, and the
 * winner is the greatest `askedAt`. Ties are impossible in practice and are
 * broken by the first one read, which is arbitrary and is stated rather than
 * hidden.
 *
 * **Never throws.** `readdirSync` on an absent or unreadable `state/` is the
 * ordinary case for a workspace that has never been asked, and it is a `null`
 * result, not a failure — `INV-hooks-fail-open`, on a hook whose stdout is the
 * model's context.
 */
export function lastRecordedAsk(root: string, sessionId: string | null): RecordedAsk | null {
  if (sessionId !== null && sessionId !== '') {
    const own = recordedAskIn(latchPath(root, sessionId), sessionId);
    if (own !== null) return own;
  }

  const dir = path.join(root, 'state');
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }

  let best: RecordedAsk | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const name of names) {
    if (!name.endsWith(ASK_LATCH_SUFFIX)) continue;
    const id = name.slice(0, -ASK_LATCH_SUFFIX.length);
    if (id === '') continue;
    // **The file is opened by the NAME `readdirSync` returned, never by
    // `latchPath(root, id)`.** `sanitizeSessionId` is not idempotent: it passes
    // a lower-case id through and FOLDS everything else to
    // `<base>-<12 hex of sha256>`, so feeding an already-folded filename back
    // through it appends a second digest and names a file that does not exist.
    // Claude Code's ids are lower-case UUIDs, so the round trip would look
    // correct for years and then quietly report "no ask was ever recorded" for
    // one whose id had a capital in it — the reassuring wrong answer, in a
    // sentence built to be believed.
    const ask = recordedAskIn(path.join(dir, name), id);
    if (ask === null) continue;
    const ms = Date.parse(ask.askedAt);
    if (ms <= bestMs) continue;
    bestMs = ms;
    best = ask;
  }
  return best;
}

/**
 * One latch file read as an ask, or `null` for every file that is not one.
 *
 * **`file` is a path and not a session id**, because its two callers hold
 * different things and only one of them holds an id `latchPath` may be given —
 * see the note at the scan loop above. `sessionId` is carried through for the
 * record only; on the scan path it is `state/`'s NAME for the session, which is
 * `sanitizeSessionId`'s output rather than the id Claude Code issued.
 *
 * **`readLatch` is deliberately NOT used here, and the reason is a measured
 * defect rather than a preference.** `readLatch` BACK-FILLS `askedAtPercent`
 * from `askedAtThreshold` for a latch written before `seq:12`, and that
 * back-fill is correct for what it was written for — deciding whether the next
 * ask is earned, where the threshold is the lowest percent the ask can have
 * gone out at and reading it low costs one ask. Quoting it HERE would be a
 * different act: the sentence would say an ask "went out at 85%" when 85 is a
 * floor, which understates the staleness in the one direction a warning must
 * never understate. Caught by
 * `test/hooks/session-start-handover-window.test.ts` — the first draft of this
 * function went through `readLatch` and the test failed on exactly that 85.
 *
 * So the raw field is required to be PRESENT. A latch that carries an ask and
 * no percentage yields nothing, and the caller then says the occupancy is not
 * recorded, which is true.
 *
 * The stamp must also PARSE. An `askedAt` that does not is dropped rather than
 * ordered last: it cannot be compared against the handover's mtime either, so
 * its percentage would be a number with no position in time beside it. That is
 * why `RecordedAsk` can be relied on downstream to carry a comparable date.
 */
function recordedAskIn(file: string, sessionId: string): RecordedAsk | null {
  let value: Record<string, unknown>;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    if (raw === null || typeof raw !== 'object') return null;
    value = raw as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof value.askedAtPercent !== 'number' || !Number.isFinite(value.askedAtPercent)) {
    return null;
  }
  const percent = askStep(value.askedAtPercent);
  if (percent === null) return null;
  const askedAt = typeof value.askedAt === 'string' ? value.askedAt : '';
  if (askedAt === '' || !Number.isFinite(Date.parse(askedAt))) return null;
  return { sessionId, askedAt, askedAtPercent: percent };
}

/**
 * What can honestly be said about the window a delivered handover came out of.
 *
 *  - `ended`          — an ask is recorded and the file was written AFTER it, so
 *                       the occupancy that ask went out at can be quoted beside
 *                       the gap to the write.
 *  - `ask-unanswered` — the most recent recorded ask is NEWER than the file.
 *                       `checkHandoverAsk`'s `ignored`, seen from the reading
 *                       end: this is not merely a report from a window that
 *                       ended, it is missing that window's last stretch.
 *  - `no-ask`         — nothing in `state/` records an ask with a percentage, so
 *                       the occupancy it was written at is NOT KNOWN. Said
 *                       plainly and never defaulted — see `no-occupancy` in
 *                       `OnDemandAskVerdict` for the same refusal on the write
 *                       side.
 *  - `unreadable`     — the handover's own mtime could not be examined, so
 *                       nothing can be ordered against anything. Kept apart from
 *                       `no-ask` for `unverifiable`'s reason: a comparison that
 *                       could not be made is not a comparison that came out
 *                       empty.
 *
 * Every one of the four still says the load-bearing thing, because that one
 * does not depend on a measurement at all: this window has just begun, so the
 * one the handover was written in has ended.
 */
export type HandoverWindowVerdict = 'ended' | 'ask-unanswered' | 'no-ask' | 'unreadable';

export interface HandoverWindowCheck {
  verdict: HandoverWindowVerdict;
  /** The occupancy the quoted ask went out at, or `null` when none is recorded. */
  percent: number | null;
  /** ISO-8601 of that ask, or `null`. */
  askedAt: string | null;
  /** ISO-8601 of the handover's last write, or `null` when it could not be read. */
  writtenAt: string | null;
  /**
   * Milliseconds between the ask and the write. Positive on both verdicts that
   * carry it, because it is a DISTANCE and the verdict already says which way
   * round they fall: on `ended` it is how long AFTER the ask the file was
   * written, on `ask-unanswered` how long BEFORE the ask it was last written.
   * `null` whenever either end is unknown.
   *
   * It is never the interval from the ask to NOW, which is the reading the
   * `ask-unanswered` sentence originally implied. `now` is not an input to this
   * function and inventing it from the clock here would put a second
   * unmeasured number in a line whose whole value is that its numbers are
   * measured.
   */
  gapMs: number | null;
  /** The `SessionStart` source that began this window, verbatim. */
  source: string;
}

/**
 * **The comparison, on the READ path.** Never throws, for any filesystem
 * outcome.
 *
 * `root` is the `.my_context` DIRECTORY and the handover is resolved against
 * its PARENT — `checkHandoverAsk`'s argument and `checkHandoverAsk`'s trap,
 * stated once there and not restated here.
 *
 * `statSync` and never `readHandover`: the caller has already read and bounded
 * the document, and re-parsing it to learn its mtime would double the one cost
 * this path has. The CONTENT is not judged here either, for the reason the
 * header of this file gives — a document this code disliked is not a document
 * it may accuse.
 */
export function checkHandoverWindow(
  root: string, handover: HandoverConfig, sessionId: string | null, source: string,
): HandoverWindowCheck {
  const base = { percent: null, askedAt: null, writtenAt: null, gapMs: null, source };

  let writtenMs: number | null = null;
  try {
    const stat = statSync(path.resolve(path.dirname(root), handover.path), {
      throwIfNoEntry: false,
    });
    if (stat !== undefined && stat.isFile()) writtenMs = stat.mtimeMs;
  } catch {
    writtenMs = null;
  }
  if (writtenMs === null) return { ...base, verdict: 'unreadable' };
  const writtenAt = new Date(writtenMs).toISOString();

  const ask = lastRecordedAsk(root, sessionId);
  if (ask === null) return { ...base, verdict: 'no-ask', writtenAt };

  // No `Number.isFinite` guard on this: `recordedAskIn` refuses a stamp that
  // will not parse, so a `RecordedAsk` in hand is one that can be ordered. A
  // guard that can never fire would claim otherwise, which is the objection
  // `readOccupancy` makes to a `try` around three calls that cannot throw.
  const askedMs = Date.parse(ask.askedAt);

  // Strictly `>`, `checkHandoverAsk`'s comparison and its argument: the ask is
  // delivered at the END of a turn and the writing happens in the next one, so
  // a real response is milliseconds to minutes later and never simultaneous.
  return writtenMs > askedMs
    ? {
        verdict: 'ended',
        percent: ask.askedAtPercent,
        askedAt: ask.askedAt,
        writtenAt,
        gapMs: writtenMs - askedMs,
        source,
      }
    : {
        verdict: 'ask-unanswered',
        percent: ask.askedAtPercent,
        askedAt: ask.askedAt,
        writtenAt,
        gapMs: askedMs - writtenMs,
        source,
      };
}

/**
 * A duration in the `d`/`h`/`m` vocabulary the audit query language already
 * uses for relative time (`core/audit.ts`, the `{ d, h, m }` table its `-2h`
 * filters parse against). One unit and never two: this appears inside a
 * sentence about staleness, where the question is an order of magnitude and a
 * second unit would buy precision nobody acts on.
 *
 * Under a minute is `less than a minute` rather than `0m`, because `0m` reads
 * as a measurement that failed.
 */
function coarseDuration(ms: number): string {
  if (ms < 60_000) return 'less than a minute';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

/**
 * How a `SessionStart` source reads in a sentence a person did not write.
 *
 * The four are `HANDOVER_SOURCES`', and nothing else can arrive: that constant
 * is a closed Set for a stated reason, and an unknown source never reaches this
 * code. The fallback clause is still written, because a Set membership test in
 * another module is not a type, and a template hole reading `undefined` in
 * model-facing text is the kind of defect that survives review.
 */
function windowBeganBecause(source: string): string {
  if (source === 'compact') return 'a compaction just rebuilt this one';
  if (source === 'clear') return 'a /clear just started this one';
  if (source === 'fork') return 'this one was just forked';
  if (source === 'startup') return 'this one has just started';
  return 'this one has just begun';
}

/**
 * **The sentence, as the model receives it** — appended to the handover block
 * on stdout, which is the one hook stream Claude Code puts into context
 * verbatim.
 *
 * ── WHY IT IS WORDED THE WAY IT IS ─────────────────────────────────────────
 *
 * The ruling is that the wording is the whole value, and the failure it names
 * is specific: on 2026-09-06 a lane died and a handover written twenty minutes
 * earlier still said it was running; the owner corrected it by hand. So this
 * does not say "old" and it does not stop at "stale" — those are adjectives a
 * reader discounts. It says which CLAUSES are historical, in the words a
 * handover actually uses to make them: *currently*, *still running*, *waiting
 * on*, *in flight*.
 *
 * **It states the record and never an inference.** "The last ask recorded
 * before it was written went out at 96%, 3m earlier" is a fact about two
 * timestamps and a stored number. "It was written at 96%" is a conclusion, and
 * it is wrong for a file somebody hand-edited three days after an ask — which
 * is a real shape here, because `reports/V2-HANDOVER.md` is edited by hand.
 * The gap is printed so that a reader can discount the percentage themselves,
 * which is what makes the line safe at every gap instead of only at short ones.
 *
 * **The claim that carries the weight needs no measurement.** `HANDOVER_SOURCES`
 * admits only the four sources that arrive with an EMPTY window, so "the window
 * it was written in has ended" is true of every delivery this can reach,
 * including the two verdicts where no number could be had.
 *
 * **`''` IS returned, for `no-ask` alone** — owner ruling 2026-09-07, and this
 * sentence used to say the opposite. Every other verdict carries a
 * MEASUREMENT: a percentage and the gap to the write, an unanswered ask, or a
 * write time that could not be read. `no-ask` carries none, so the only thing
 * it could say is that the window ended — which is true of every delivery this
 * function can reach, and so tells a reader nothing they did not already know
 * from a handover being delivered at all.
 *
 * It is also the COMMON case, which is what decided it rather than taste: the
 * latch is reset when a window is rebuilt, so a corpus sitting below its
 * threshold reads `askedAtPercent: null` on every session start. The line
 * would have spent ~95 tokens every time to warn about nothing measurable.
 */
export function endedWindowLine(check: HandoverWindowCheck): string {
  const began = windowBeganBecause(check.source);
  const historical = 'so every "currently", "still running", "in flight" and "waiting on" '
    + 'above is a claim about a session that is OVER';

  if (check.verdict === 'ended' && check.percent !== null && check.gapMs !== null) {
    return '_READ THIS AS HISTORY. The last handover ask recorded before this file was written '
      + `went out at ${check.percent}% of a context window, ${coarseDuration(check.gapMs)} before `
      + `the write. That window has ENDED — ${began} — ${historical}. Verify each one against `
      + 'the repository before you act on it._\n';
  }

  if (check.verdict === 'ask-unanswered' && check.percent !== null && check.gapMs !== null) {
    // The gap is stated as what it MEASURES — the last write to the ask — and
    // never as "not written in the Nh since", which would name a different
    // interval (the ask to now) that this function was not given and does not
    // hold. One wrong interval in a sentence built to be believed is the same
    // defect as one wrong percentage.
    return '_READ THIS AS HISTORY, AND AS INCOMPLETE. A handover update was asked for at '
      + `${check.percent}% of a context window, and this file was last written `
      + `${coarseDuration(check.gapMs)} BEFORE that ask and not since — so whatever provoked the `
      + `ask is not in it. That window has ENDED — ${began} — ${historical}, and its last `
      + 'stretch was never written down at all._\n';
  }

  if (check.verdict === 'unreadable') {
    return '_READ THIS AS HISTORY. When this file was last written could not be read, so how far '
      + 'into its window it was written is not stated here and is not guessed. What is certain '
      + `is that it was written before this window — ${began} — ${historical}._\n`;
  }

  // `no-ask` is SILENT, owner ruling 2026-09-07.
  //
  // It is the one verdict with no number behind it: nothing in `state/` records
  // an ask carrying a percentage, so the line could say only that the window
  // ended — which is true, and true of every delivery this function can reach,
  // and therefore carries no information a reader did not already have from the
  // fact that a handover is being delivered at all.
  //
  // It is also the COMMON case rather than the rare one, which is what decided
  // it: a latch is reset the moment a window is rebuilt, so a corpus sitting
  // below its threshold has `askedAtPercent: null` on every session. Spending
  // ~95 tokens per session start to say "this is from before now" is a cost
  // paid every time to warn about nothing measurable.
  //
  // The three verdicts that DO carry a measurement still speak. Silence here is
  // not the absence of a warning; it is the absence of anything to warn about,
  // and `''` is distinguishable from an unwritten branch because
  // `endedWindowLine` is total over the union and every other arm returns text.
  return '';
}
