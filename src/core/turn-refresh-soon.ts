/**
 * ── THE REFRESH THAT NO LONGER WAITS FOR THE END OF A LONG TURN ─────────────
 *
 * **The owner, 2026-09-16, and the second sentence is the design:** *"if the
 * post tool use hook is expensive you can still mark at stop but at post tool
 * check if flush required (it's cheap) and if yes, do it async so the hook
 * could be released very fast"* — and then, widening it: *"you should flush in
 * general not only because of a mark was added"*.
 *
 * ── WHAT WAS ACTUALLY WRONG, MEASURED BEFORE ANY OF THIS WAS WRITTEN ───────
 *
 * A lane reported that the anchor writer BATCHES — that a mark could sit five
 * and a half minutes before being flushed. **It does not, and that report was
 * wrong.** An anchor row's `at` is the timestamp of the TURN it points at,
 * copied verbatim out of the index (`anchor-pass.ts` passes `hit.at` /
 * `span.at` / `last.at` into `consider`, and the `new Date()` there is only a
 * fallback). Checked against the transcript on six consecutive marks, all six
 * matched their record's own timestamp TO THE MILLISECOND.
 *
 * So the five and a half minutes was never a flush delay. It was the TURN:
 * between the marked record at 08:48:26.710 and the store write at
 * 08:54:03.826, **85 records were written** — 33 assistant, 20 attachments, 15
 * user, tool traffic throughout. The turn was still running.
 *
 * **THE REAL DEFECT IS THE ONE THAT SURVIVES THAT CORRECTION.**
 * `stopConversationRefresh` is wired in exactly one place — `src/hooks/stop.ts`
 * — so everything it does (the index scan, the mirror, the anchors) happens at
 * END OF TURN and nowhere else. A table written in the first minute of a
 * six-minute turn is not indexed, not mirrored and not marked until minute
 * six. Nothing is broken; the work is simply scheduled at the one moment that
 * is furthest from when it became possible.
 *
 * ── WHY THE CHECK LIVES HERE AND THE WORK DOES NOT ─────────────────────────
 *
 * `PostToolUse` fired **85 times** in that one turn. Anything it does is paid
 * for eighty-five times, so this module answers only the cheap question — HAS
 * THE TRANSCRIPT GROWN ENOUGH, AND HAS IT BEEN LONG ENOUGH — out of one
 * `statSync` (0.007 ms on a 133 MB file) against a recorded pair. The refresh
 * itself costs 141–1223 ms depending on how many lanes are running, and it is
 * spawned DETACHED so the hook returns without waiting for any of it.
 *
 * **The hook must never block on this and never fail because of it.**
 * `INV-hooks-fail-open`. A decision this module cannot make is a decision not
 * to spawn, and the reason travels with it rather than being swallowed.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * How long after a spawn the next one may happen, and how much the transcript
 * must have grown in between.
 *
 * **Both numbers are measured off the turn that prompted this, not chosen.**
 * That turn ran 5m 37s and grew the transcript by 277,601 bytes — about
 * 16,300 bytes per twenty seconds of real work.
 *
 * `GAP_MS` at 15 s bounds the cost: at most four spawns a minute however hard
 * a turn works, so the eighty-five firings of that turn could have produced at
 * most twenty-two refreshes and in practice produce fewer, because BOTH
 * conditions must hold.
 *
 * `GROWTH_BYTES` at 8 KiB is the half that stops a THINKING turn paying
 * anything. It sits deliberately below the ~16 KiB a twenty-second slice of
 * that turn produced — so a turn doing real work crosses it inside one gap —
 * and above any single prose message, so a turn that emits one short answer
 * and waits does not spawn at all and is caught by `Stop` as it always was.
 *
 * Neither is a ceiling on correctness: MISSING A SPAWN COSTS NOTHING BUT
 * LATENCY, because `Stop` still runs the same refresh at the end of the turn.
 * That is what makes it safe to be stingy here.
 */
export const REFRESH_SOON_GAP_MS = 15_000;
export const REFRESH_SOON_GROWTH_BYTES = 8_192;

/** What the last spawn saw: the transcript's size, and when. */
export interface RefreshSoonState {
  size: number;
  at: number;
}

/**
 * Why a tick did not spawn — and `could-not-look` is a SEPARATE value from
 * every "nothing to do" beside it.
 *
 * `nothing-to-do-and-could-not-look-are-different-answers` (rule store). A
 * `stat` that refuses for a reason that is not absence has learned nothing
 * about the transcript, and reporting that as `too-little` would tell the
 * caller the file had not grown — a claim about the world nobody measured.
 * `absent` is the measured zero: there is no transcript, which is a real state
 * for a session the harness has pruned.
 */
export type RefreshSoonWhy =
  | 'no-transcript-path'
  | 'absent'
  | 'could-not-look'
  | 'too-soon'
  | 'too-little';

export type RefreshSoonDecision =
  | { due: true; size: number; grown: number }
  | { due: false; why: RefreshSoonWhy; size: number | null };

/**
 * The transcript's size right now, `null` when it could not be looked at, and
 * `'absent'` when it measurably is not there.
 *
 * ENOENT is narrowed deliberately and is the ONLY errno that means absence.
 * Every other refusal — a permission, a racing rename, an I/O error — is a
 * tick that did not learn.
 */
function sizeOf(file: string): number | 'absent' | null {
  try {
    return statSync(file).size;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'absent' : null;
  }
}

/**
 * The whole decision, as a pure function of what was read.
 *
 * Separated from the reading so a test can drive every branch — including
 * `could-not-look`, which no portable filesystem trick produces reliably on
 * both Windows and POSIX.
 */
export function refreshSoonDecision(args: {
  size: number | 'absent' | null;
  state: RefreshSoonState | null;
  now: number;
  gapMs?: number;
  growthBytes?: number;
}): RefreshSoonDecision {
  const gapMs = args.gapMs ?? REFRESH_SOON_GAP_MS;
  const growthBytes = args.growthBytes ?? REFRESH_SOON_GROWTH_BYTES;

  if (args.size === null) return { due: false, why: 'could-not-look', size: null };
  if (args.size === 'absent') return { due: false, why: 'absent', size: null };

  // **NO STATE IS NOT A REASON TO SPAWN.** The first tick of a session records
  // where the transcript stood and spawns nothing: `Stop` has always refreshed
  // at the end of the turn, so the baseline costs one `statSync` and the very
  // next tick can make a real comparison. Spawning here instead would put a
  // refresh on the first tool call of every session, which is the moment the
  // index is least likely to be behind and the machine is busiest.
  if (args.state === null) return { due: false, why: 'too-soon', size: args.size };

  if (args.now - args.state.at < gapMs) return { due: false, why: 'too-soon', size: args.size };

  // A transcript only ever appends, but a REPLACED one reads smaller — and a
  // negative "growth" must not be treated as growth. `Math.max` is not the
  // answer: a shrink means these offsets describe a different file, which is
  // `Stop`'s business and not a reason to spawn a refresh from here.
  const grown = args.size - args.state.size;
  if (grown < growthBytes) return { due: false, why: 'too-little', size: args.size };

  return { due: true, size: args.size, grown };
}

/** Where a session's baseline is kept, beside the state this project already writes. */
export function refreshSoonStatePath(projectRoot: string, sessionId: string): string {
  return path.join(projectRoot, 'state', `${sessionId}.turn-refresh.json`);
}

export function readRefreshSoonState(file: string): RefreshSoonState | null {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<RefreshSoonState>;
    if (typeof raw.size !== 'number' || typeof raw.at !== 'number') return null;
    return { size: raw.size, at: raw.at };
  } catch {
    // A baseline that cannot be read is a baseline that is not there, and the
    // consequence is identical: record one and spawn nothing this tick. This
    // is the one place the two answers genuinely ARE the same, because the
    // caller's next act is the same either way — so collapsing them here costs
    // nothing a reader could act on.
    return null;
  }
}

export function writeRefreshSoonState(file: string, state: RefreshSoonState): void {
  try {
    const dir = path.dirname(file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(state));
  } catch {
    // Failing to record the baseline costs latency and nothing else: the next
    // tick reads no state, records one, and the turn is still refreshed by
    // `Stop`. A hook may not fail because a convenience file would not write.
  }
}

/**
 * The cheap half, end to end: look, decide, and record the baseline when a
 * spawn is due.
 *
 * The baseline is written by the caller that SPAWNS and not by the one that
 * merely looked, so a tick that decided not to spawn does not move the clock
 * a later tick is measuring against.
 */
export function refreshSoonCheck(args: {
  transcriptPath: string | null | undefined;
  projectRoot: string;
  sessionId: string | null | undefined;
  now?: number;
}): RefreshSoonDecision {
  if (args.transcriptPath === null || args.transcriptPath === undefined
    || args.transcriptPath === '' || args.sessionId === null
    || args.sessionId === undefined || args.sessionId === '') {
    return { due: false, why: 'no-transcript-path', size: null };
  }
  const now = args.now ?? Date.now();
  const file = refreshSoonStatePath(args.projectRoot, args.sessionId);
  const decision = refreshSoonDecision({
    size: sizeOf(args.transcriptPath),
    state: readRefreshSoonState(file),
    now,
  });
  // The baseline moves when a spawn is due, AND on the first tick that has a
  // size and no baseline — otherwise a session would never acquire one.
  if (decision.due) writeRefreshSoonState(file, { size: decision.size, at: now });
  else if (decision.why === 'too-soon' && decision.size !== null
    && readRefreshSoonState(file) === null) {
    writeRefreshSoonState(file, { size: decision.size, at: now });
  }
  return decision;
}
