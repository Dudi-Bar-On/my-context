import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { recordAudit } from '../core/audit.ts';
import { resolveConfig } from '../core/config.ts';
import { readHandover, type HandoverRead } from '../core/handover.ts';
import { resetAsksForWindow, type AskWindowResetVerdict } from '../core/handover-ask.ts';
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
 * **THE ONE THING IT DOES RATHER THAN RECORDS — `plan:handover seq:10`.** It
 * returns the handover ask budget to the window the compaction rebuilt. That
 * is a write, and the paragraph above is why it is not a contradiction: this
 * hook cannot restore anything, but it is the ONLY event that fires once a
 * compaction is known to have COMPLETED, and it is the only one holding the
 * snapshot whose `capturedAt` identifies the rebuilt window. Three consequences
 * follow, and together they are the whole argument for the site:
 *
 *  - **Not `SessionStart(source: 'compact')`.** It fires from inside the try
 *    block before the summary is committed (point 3 above), so a reset there
 *    would hand a fresh budget to a compaction that then threw and left the
 *    original window standing.
 *  - **Not `Stop`.** That is where the ask is MADE, and a mechanism that
 *    decided at ask time whether its window was new would be deciding what a
 *    window is for the second time in this codebase — and paying for it on
 *    every assistant turn of every session.
 *  - **Not derived here either.** The identity is `snapshot.capturedAt`, the
 *    field `restoredFor` already compares against further down the same function.
 *
 * `recordPostCompact`'s standing restraint — *nothing acts on any of these
 * counts, and pruning the seen file is the owner's call and not this hook's* —
 * is unchanged and still governs the three counts. The budget is not one of
 * them: the owner made that call on 2026-08-29.
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
 *
 * **THE HANDOVER IS RESOLVED HERE AND DELIVERED SOMEWHERE ELSE** (spec §2).
 * This hook can read a file and it cannot speak, so it does the reading: which
 * handover the project configured, whether it is actually there, and how big
 * it is, recorded on the row below. `SessionStart(source: 'compact')` delivers
 * the bounded block, because its stdout is the one hook output the model
 * receives. That division is not a workaround — it is the paragraph above,
 * applied: the hook that knows something records it, and the hook that can
 * speak says it. Nothing about the handover is written to stdout here, and
 * nothing about it is written to stderr either: on this event both are folded
 * into a message shown to the USER after every compaction, and a banner about
 * a file they maintain is not what they asked the compaction for.
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
  /**
   * What became of the handover ask budget for the window this compaction
   * rebuilt — `plan:handover seq:10`. The one thing this hook DOES rather than
   * merely records; `recordPostCompact` argues the site.
   */
  askBudget: AskWindowResetVerdict;
  note: string;
}

/**
 * The handover this project configured, resolved for the row below.
 *
 * **`config.json` is read HERE rather than through `resolveWorkspace`**, for
 * the reason `recordPostCompact` gives for using `findProjectRoot`: that
 * function throws on a `config.json` that is not valid JSON, and a workspace
 * with a broken config is still a workspace whose compaction must be recorded.
 * So the two failures are caught and REPORTED as "nobody looked" rather than
 * being allowed to take the whole row down — or, worse, to be answered `off`,
 * which is the positive claim that somebody looked and found no `handover`
 * key.
 *
 * **`path.dirname(root)`, and this line is a trap with no symptom.**
 * `findProjectRoot` returns the `.my_context` DIRECTORY, not the repository
 * root, and `handover.path` is validated as repo-relative. Passing `root`
 * straight through resolves `reports/H.md` to
 * `<repo>/.my_context/reports/H.md`, which never exists — so EVERY configured
 * handover on every machine would record `missing`, the one value that means
 * "a handover was configured and is not there". The wrong answer is
 * indistinguishable from the true one, which is why it is spelled out here and
 * pinned by a test that puts a real file at the repo-relative path. Five other
 * call sites in this codebase take the same `path.dirname` step.
 */
function resolveHandover(root: string): { read: HandoverRead | null; why: string | null } {
  const file = path.join(root, 'config.json');
  let raw: unknown = {};
  try {
    if (existsSync(file)) raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return { read: null, why: `config.json is not readable JSON (${reason(err)})` };
  }
  try {
    return { read: readHandover(path.dirname(root), resolveConfig(raw).handover), why: null };
  } catch (err) {
    // `resolveConfig` refuses a config it does not understand rather than
    // loading half of it, and its refusals are paragraphs written for the
    // person who has to fix the file. They are printed in full by every
    // surface that loads a config; here the note carries the first sentence of
    // it, enough to say WHICH file and WHAT about it, because an audit note is
    // scope and a reader scanning rows for a lost handover does not want the
    // remedial paragraph in every one of them.
    return { read: null, why: `config.json was refused (${reason(err)})` };
  }
}

function reason(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.length > 160 ? `${message.slice(0, 160)}...` : message;
}

/**
 * The three fields, written explicitly per state and never inferred from an
 * absence.
 *
 * The full argument for them living on `AuditRecord` — rather than in `note`,
 * and rather than reusing `path` — is on the fields themselves in
 * `core/audit.ts`. What matters at this call site is the shape: `off` carries
 * NO path (there is no file to name, and naming one would invent it), `missing`
 * carries the path and no count (nothing was read, and 0 would be a
 * measurement), and a config nobody could read carries nothing at all, so that
 * absence keeps meaning "not recorded".
 */
function handoverFields(read: HandoverRead | null): {
  handoverState?: HandoverRead['state'];
  handoverPath?: string;
  handoverLines?: number;
} {
  if (read === null) return {};
  if (read.state === 'off') return { handoverState: 'off' };
  if (read.state === 'missing') return { handoverState: 'missing', handoverPath: read.path };
  // `totalLines`, not `deliveredLines`: this hook resolves and cannot deliver,
  // so the count it records is the document's own. What any one session was
  // actually handed is `SessionStart`'s fact, declared in the block that
  // session received.
  return { handoverState: 'read', handoverPath: read.path, handoverLines: read.totalLines };
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
 * Nothing acts on any of them. That is deliberate: pruning the seen file of ids
 * that neither the summary nor the restore carried is the obvious next move and
 * it is a behaviour change to the dedupe state, which is the owner's call and
 * not this hook's. The measurement comes first, in the log, where it can be
 * read before anything is decided.
 *
 * **`askBudget` is the one thing that is acted on, and it is here because the
 * owner made that call.** `plan:handover seq:10`, 2026-08-29: each rebuilt
 * context window gets its own two asks. The reset is not a fourth count and
 * does not touch the three above; it hands `core/handover-ask.ts` the window
 * identity this hook already holds and lets that module decide what to do with
 * it. The file header argues why this event and not the two neighbouring ones,
 * and `resetAsksForWindow` argues why a compaction with no snapshot resets
 * nothing.
 *
 * The handover resolved beside them is under the same discipline and one step
 * further from action: it is recorded, it is not returned on the outcome, and
 * it is not written anywhere a person or a model can see it. `SessionStart`
 * delivers it. What this row adds is the ability to ask, later, whether the
 * handover a project promised was actually there at the compaction that
 * needed it.
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

    // THE HANDOVER ASK BUDGET, RETURNED TO THE WINDOW THIS COMPACTION REBUILT.
    // `plan:handover seq:10`, and it is done FIRST — before the summary scan
    // and the seen read — so that nothing measured for the row can come
    // between the window being rebuilt and its budget arriving.
    //
    // The window identity is `snapshot.capturedAt`, taken off the object this
    // hook has ALREADY read, and it is the continuity tier's identity rather
    // than a second one: `restoredFor` further down this function compares against
    // the same field of the same snapshot, as does `continuityFor` in
    // `core/inject.ts` step 2b. No notion of "a new window" is derived here.
    //
    // A compaction with NO snapshot passes `null`, which returns nothing —
    // `resetAsksForWindow` argues that direction where the rule lives.
    const askBudget = resetAsksForWindow(root, sessionId, snapshot?.capturedAt ?? null);

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
    // Only the case no FIELD can carry reaches the note. `off`, `missing` and
    // `read` are `handoverState`, and repeating any of them in prose here would
    // be one value living in two places — the trade `pre-compact.ts` names and
    // refuses on its own occupancy row.
    const handover = resolveHandover(root);
    if (handover.why !== null) parts.push(`handover unknown (${handover.why})`);
    // `''` on the two verdicts where nothing happened and nothing was owed —
    // `nothing-asked`, which is nearly every compaction in nearly every
    // workspace, and `same-window`, which is one compaction firing twice. The
    // three that changed something, or failed to, say so
    // (INV-nothing-is-dropped-silently).
    if (askBudget.note !== '') parts.push(askBudget.note);
    const note = parts.join('; ');

    recordAudit(root, {
      kind: 'hook', op: 'post-compact', sessionId, hook: 'PostCompact',
      ...handoverFields(handover.read), note,
    });

    return { trigger, captured, survived, restored, askBudget: askBudget.verdict, note };
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
