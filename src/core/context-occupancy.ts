import { existsSync } from 'node:fs';
import { classifyContext, readTee, statuslineDir } from './statusline-tee.ts';

// --- How full is this session's context window? -----------------------------
//
// A thin adapter over the status-line tee, and the thinness is the design.
// `classifyContext` already returns `percent`, computed from Claude Code's own
// `context_window_size` and its own `current_usage`, so NOTHING is computed
// here. There is deliberately no fallback that derives a percentage from the
// transcript: `context_window_size` is not in the transcript, so a transcript
// fallback needs a model-to-window table, and a table like that goes stale in
// silence — it keeps answering, with the wrong denominator, on every model
// released after it was written. A mechanism that stands down loudly is
// recoverable; one that quietly reports 61% of the wrong window is not.
//
// So this module's real job is the REFUSAL, and the shape of the refusal.
// `Occupancy` has no `percent: number | null` — an unmeasurable occupancy has
// no percentage field at all, which is what stops a caller writing
// `occupancy.percent ?? 0` and turning "we never measured" into "the window is
// empty". That is `STD-absent-vs-zero` expressed in the type rather than in a
// comment a caller can skip.
//
// Callers: `Stop` (spec §4.3), which asks the model for a handover once at the
// threshold, and `PreCompact` (spec §4.4), which records the occupancy it fired
// at so the threshold stops being a guess. `Stop` runs on EVERY assistant turn,
// which is why this reads one small file the bridge has already written and
// does no directory walk and no transcript scan (spec §5).

/**
 * Why an occupancy could not be measured. Three reasons, and they are kept
 * apart because they are three different things to tell a human and they have
 * three different fixes:
 *
 *  - `no-bridge`     — there is no `.statusline/` at all. The opt-in bridge was
 *                      never installed, so nothing has ever sampled this
 *                      workspace. The owner installs it, once.
 *  - `no-sample`     — the bridge is installed but has no usable reading for
 *                      THIS session yet. Nothing is broken; the next assistant
 *                      message produces one.
 *  - `unknown-shape` — there IS a sample and `classifyContext` cannot read it.
 *                      Claude Code's status-line schema has moved, and that is
 *                      a claim about an external interface this repository does
 *                      not own (see `statusline-tee.ts`'s EXTERNAL SCHEMA note).
 *
 * Collapsing them to a single "unavailable" was the tempting simplification and
 * is what makes the disclosure useless: a person told "not installed" about a
 * bridge that IS installed goes and installs it a second time.
 */
export type UnmeasurableWhy = 'no-bridge' | 'no-sample' | 'unknown-shape';

export type Occupancy =
  | { state: 'unmeasurable'; why: UnmeasurableWhy }
  | { state: 'known'; percent: number; usedTokens: number; windowSize: number };

/**
 * Reads how full `sessionId`'s context window is, or names why it cannot.
 *
 * **Never throws**, because both callers sit on hook paths that must fail open
 * (`INV-hooks-fail-open`) and `Stop`'s runs on every turn. That is inherited
 * rather than bolted on: `existsSync` does not throw, `readTee` is documented
 * as returning `null` for every failure it can meet — missing file, unsafe
 * session id, torn JSON, wrong envelope — and `classifyContext` is a pure read
 * over an already-parsed value that degrades to `'unknown'` on any shape it
 * does not recognise. No `try` is added here on top of that: a `try` that can
 * never fire is a claim that one of those three can throw, which would be
 * wrong, and it would hide a genuine new throw behind a shrug.
 */
export function readOccupancy(root: string, sessionId: string): Occupancy {
  // Checked BEFORE `readTee`, and it is the only reason this module touches the
  // filesystem itself. `readTee` cannot tell the two absences apart: a missing
  // directory and a missing file inside an existing one both surface as `null`,
  // and that single `null` is exactly the collapse the three reasons exist to
  // undo. One `existsSync` on a path already in hand is the cheapest way to
  // separate "never installed" from "installed and quiet".
  if (!existsSync(statuslineDir(root))) return { state: 'unmeasurable', why: 'no-bridge' };

  // Everything `readTee` returns `null` for lands here as `no-sample`, and that
  // deliberately includes a session id `sanitizeSessionId` refused and a sample
  // file a killed writer left unreadable. Neither is `unknown-shape`: nothing
  // about Claude Code's schema is implicated, and "the bridge has no reading
  // for this session" is true of both. The alternative — reaching past
  // `readTee` to `teePath` and `existsSync` to split those out — would buy a
  // fourth reason nobody can act on differently, at the cost of duplicating
  // that module's file-naming rule here, where it would drift.
  const tee = readTee(root, sessionId);
  if (tee === null) return { state: 'unmeasurable', why: 'no-sample' };

  const sample = classifyContext(tee.payload);

  // **`not-yet-known` is `no-sample`, NOT `unknown-shape`.** This is the one
  // place this module departs from the plan's sketch, which mapped every
  // non-`known` state to `unknown-shape`. `classifyContext` returns
  // `not-yet-known` for `current_usage === null`, which is what Claude Code
  // sends between a compaction and the next API call — the exact window in
  // which a handover mechanism is most likely to be reading this. Reporting a
  // schema break there would send a person to re-verify Claude Code's binary
  // over a payload that was perfectly well formed and simply had nothing to
  // report yet. The bridge has spoken and still has no reading: `no-sample`.
  if (sample.state === 'not-yet-known') return { state: 'unmeasurable', why: 'no-sample' };

  // The three `null` checks are not defensive padding: `classifyContext` can
  // return `state: 'known'` with `percent === null`, when `current_usage` parsed
  // but `context_window_size` was absent or zero. A window size that is missing
  // or zero IS a shape this code cannot read, and there is no percentage to be
  // had from it — so it degrades here rather than dividing by zero or shipping
  // a `null` the caller has to re-check. Testing all three also makes the
  // narrowing structural, so a later widening of `ContextSample` cannot let a
  // `null` through as a `number`.
  if (sample.state !== 'known' || sample.percent === null || sample.usedTokens === null
      || sample.windowSize === null) {
    return { state: 'unmeasurable', why: 'unknown-shape' };
  }

  return {
    state: 'known',
    percent: sample.percent,
    usedTokens: sample.usedTokens,
    windowSize: sample.windowSize,
  };
}

/**
 * The one-line stderr disclosure for an occupancy that could not be measured.
 *
 * Modelled on `hooks/io.ts` · `export function noWorkspaceLine(cwd: string): string {`:
 * prefixed once with `my_context:` per `STD-error-message-conventions`, one
 * line ending in a newline, and written for someone who does not know this
 * product — it says what is missing, what it cost, and the ONE thing that
 * would fix it.
 *
 * Stderr is the only channel available and the right one. There is nothing to
 * put in the model's context — the whole point is that the mechanism is
 * standing down — and the person who can install a bridge or report a schema
 * change is the user, who is who Claude Code shows stderr to.
 *
 * Each line also says that nothing else changed. A user who reads a my_context
 * line mid-task needs to know their turn was not blocked
 * (`INV-hooks-fail-open`); a disclosure that reads like a failure is how a
 * working session gets abandoned.
 */
export function occupancyStandDownLine(why: UnmeasurableWhy): string {
  if (why === 'no-bridge') {
    return (
      'my_context: the context window’s fullness cannot be measured here — the status-line ' +
      'bridge is not installed, so nothing has ever reported how full this session is and ' +
      'nothing will ask you to refresh the handover before a compaction. Only Claude Code ' +
      'knows the size of the window, and that bridge is how it says so: run `mycontext ' +
      'statusline install` to add it (it prints your current status line first and replaces ' +
      'it only with --yes). Nothing else about this turn changed.\n'
    );
  }
  if (why === 'no-sample') {
    return (
      'my_context: the context window’s fullness cannot be measured yet — the status-line ' +
      'bridge is installed but has no sample for this session, which is what a session that ' +
      'has just started or has just been compacted looks like. The bridge samples once per ' +
      'assistant message, so the next one should supply it. Nothing needs fixing, and nothing ' +
      'else about this turn changed.\n'
    );
  }
  return (
    'my_context: the context window’s fullness cannot be read — the status line reported a ' +
    'shape this version of my_context does not recognise, which means Claude Code has changed ' +
    'the data it sends there. No percentage is guessed from it, so nothing will ask you to ' +
    'refresh the handover before a compaction. Upgrading my_context, or reporting the Claude ' +
    'Code version you are on, is what fixes it; nothing else about this turn changed.\n'
  );
}
