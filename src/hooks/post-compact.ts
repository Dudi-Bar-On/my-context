import { recordAudit } from '../core/audit.ts';
import { readSnapshotMeta, scanTextIds } from '../core/ledger.ts';
import { isMainEntry } from '../core/paths.ts';
import { readSeen, restoredFor } from '../core/seen-file.ts';
import { findProjectRoot } from '../core/workspace.ts';
import { hookParseErrorLine, parseHookInput, readStdin, type HookInput } from './io.ts';

/**
 * The event, where `SessionStart(source: 'compact')` was only ever the proxy.
 *
 * **What the proxy could not say, and this can.** Three things, all of them on
 * the payload and none of them derivable from a `source` string:
 *
 *  1. **`trigger`** — `"manual"` or `"auto"`. `source: 'compact'` is one value
 *     for both, so nothing in this project could tell a compaction the user
 *     asked for from one the context window forced. Those are different events
 *     for anybody tuning a budget: an `auto` compaction is the product telling
 *     you the window filled up.
 *  2. **`compact_summary`** — the conversation summary compaction produced,
 *     verbatim. It is the ENTIRE content of the window that comes out the other
 *     side, and it does not exist anywhere the proxy can reach: the transcript
 *     on disk still holds the pre-compaction conversation at the moment
 *     `SessionStart` fires.
 *  3. **That the compaction COMPLETED.** `PreCompact` writes the restore
 *     snapshot and then the compaction can still throw; `SessionStart(compact)`
 *     is fired from inside that same try block, BEFORE the summary is committed
 *     (traced on build 2.1.239: the restore-attachment builder calls
 *     `rit(t.session,"compact",…)` and the caller calls the PostCompact emitter
 *     `Hzt` afterwards, on every one of the three compaction paths). So a
 *     `pre-compact` row with no `post-compact` row beside it is a compaction
 *     that did not finish — the same attempted/complete pairing
 *     `hooks/subagent-start.ts` uses.
 *
 * **ORDER, because it decides what this hook can and cannot be.**
 * `SessionStart(source: 'compact')` fires FIRST and `PostCompact` second, on
 * all three paths. The restore has therefore already happened by the time this
 * runs, so nothing here can feed it. This hook records; it does not restore,
 * and it could not.
 *
 * **THERE IS NO OUTPUT ENVELOPE FOR THIS EVENT.** Build 2.1.239 declares a
 * `hookSpecificOutput` variant for twenty events and `PostCompact` is not one
 * of them — there is no `additionalContext` to fill. What a `PostCompact`
 * hook's stdout becomes is a line of USER-facing display text,
 * `PostCompact [<command>] completed successfully: <output>`, appended to the
 * compaction's own message. So writing on the happy path would put a banner
 * in front of the user after every compaction, and this hook writes nothing
 * there. The model never sees a byte of it either way.
 *
 * **It does not fire inside a subagent.** The emitter returns early on an agent
 * context, exactly as the `SessionStart(compact)` producer does, so — like
 * `PreCompact` — this is a parent-only event and the snapshot it reads stays
 * parent-keyed.
 */

/**
 * What the compaction did to the ids `PreCompact` captured, counted three ways.
 * Counts only, never ids and never a line of the summary: an audit note is
 * scope, not content, and `compact_summary` is the most content-bearing field
 * any payload in this project carries.
 */
export interface PostCompactOutcome {
  trigger: string;
  /** `null` when no snapshot exists for this session — see the note below. */
  captured: number | null;
  /** How many captured ids the summary still names. `null` with no summary. */
  survived: number | null;
  /** How many the restore tier re-delivered for THIS compaction. */
  restored: number;
  note: string;
}

/**
 * Runs one `PostCompact`. Returns `null` when there is nothing to record —
 * no payload, no `session_id`, no workspace. Never throws
 * (`INV-hooks-fail-open`).
 *
 * **Why three counts and not one.** They answer three different questions that
 * a single number silently merges:
 *
 *  - `captured` is what `PreCompact` put in the snapshot, and it is the
 *    over-capture the restore design deliberately accepts.
 *  - `restored` is what the restore tier actually re-delivered for this
 *    compaction — `restoredFor` keys on the snapshot's own `capturedAt`, the
 *    same equality `core/inject.ts` uses, so it counts THIS compaction and not
 *    the last one. Less than `captured` means the restore tier's budget spilled
 *    the difference to index lines.
 *  - `survived` is what the summary still names on its own. It is the number
 *    nothing in this project could ever produce before, and it is the one that
 *    says whether the re-injection was needed: an id the summary already
 *    carries was re-delivered into a window that already had it.
 *
 * Nothing acts on any of them. That is deliberate and it is the whole scope of
 * this commit: pruning the seen file of ids that neither the summary nor the
 * restore carried is the obvious next move and it is a behaviour change to the
 * dedupe state, which is the owner's call and not this hook's. The measurement
 * comes first, in the log, where it can be read before anything is decided.
 *
 * **`findProjectRoot`, not `resolveWorkspace`**, for the reason
 * `session-start.ts` gives at its sweep: the latter throws on a `config.json`
 * that is not valid JSON, and a workspace with a broken config is still a
 * workspace whose compaction should be recorded.
 */
export function recordPostCompact(
  input: HookInput, fallbackCwd: string,
): PostCompactOutcome | null {
  try {
    const sessionId = input.session_id;
    if (!sessionId) return null;
    const root = findProjectRoot(input.cwd ?? fallbackCwd);
    if (!root) return null;

    // Absent rather than defaulted: `manual` and `auto` are the two the schema
    // declares, and inventing one of them for a payload that carried neither
    // would put a claim in the log that no payload supports.
    const trigger = typeof input.trigger === 'string' && input.trigger !== ''
      ? input.trigger
      : '<absent>';

    const snapshot = readSnapshotMeta(root, sessionId);
    const captured = snapshot === null ? null : snapshot.itemIds.length;

    // `null`, never 0, when there is no summary to scan. Zero would read as
    // "the compaction dropped every item", which is the opposite conclusion
    // from "nobody looked" and is exactly the conflation
    // INV-nothing-is-dropped-silently forbids.
    const summary = typeof input.compact_summary === 'string' ? input.compact_summary : null;
    const survived = summary === null || snapshot === null
      ? null
      : scanTextIds(summary, new Set(snapshot.itemIds)).length;

    // What the restore tier re-delivered for THIS compaction, read back out of
    // the seen file the SessionStart before us has already written. An
    // unreadable seen file gives 0 and is disclosed rather than counted as a
    // restore that did not happen.
    const seenState = snapshot === null ? null : readSeen(root, sessionId);
    const restored = seenState !== null && seenState.error === null
      ? restoredFor(seenState, snapshot!.capturedAt).size
      : 0;

    const parts = [`trigger=${trigger}`];
    parts.push(summary === null
      ? 'no compact_summary on the payload, so nothing could be checked against it'
      : `summary ${summary.length} chars`);
    parts.push(captured === null
      ? 'NO PreCompact snapshot for this session — the compaction restored nothing, and ' +
        'whatever this window held is not coming back'
      : `snapshot ${captured} id(s), ${restored} re-delivered by the restore tier` +
        (survived === null ? '' : `, ${survived} still named in the summary`));
    if (snapshot !== null && seenState !== null && seenState.error !== null) {
      parts.push('the seen file could not be read, so the re-delivered count is a floor');
    }
    const note = parts.join('; ');

    recordAudit(root, {
      kind: 'hook', op: 'post-compact', sessionId, hook: 'PostCompact', note,
    });

    return { trigger, captured, survived, restored, note };
  } catch {
    // INV-hooks-fail-open. A knowledge base that breaks a compaction is worse
    // than one that says nothing.
    return null;
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer, for `pre-compact.ts`'s reason: everything below is
  // synchronous, so a timer set before it can only fire after the work it was
  // meant to preempt already returned. The bound is the `hooks.json` timeout,
  // which this event — unlike `SessionEnd` — really does honour: the emitter
  // passes the compaction's own abort signal and no timer of its own.
  try {
    const { input, parseError } = parseHookInput(readStdin());
    // On stderr, which on THIS event does reach the user: Claude Code folds a
    // PostCompact hook's output into the message the compaction prints. That is
    // also why nothing is written on the happy path — a line there would be a
    // banner after every compaction.
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    recordPostCompact(input, process.cwd());
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
