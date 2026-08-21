import { rmSync } from 'node:fs';
import { recordAudit, type InjectedRef, type SpilledRef } from './audit.ts';
import { focusErrorNote, readFocus } from './focus.ts';
import { readSnapshotMeta, snapshotPath } from './ledger.ts';
import { rebuildRoots } from './open-store.ts';
import {
  crossLayerCollisions, loadErrorNote, loadLayer, rebuild, retryOnTransientFsError,
  type LoadError,
} from './rebuild.ts';
import { renderSelection, SUBAGENT_PREAMBLE } from './render.ts';
import { agentRevisionNotice, pendingRevisions } from './revision.ts';
import { select } from './select.ts';
import {
  appendSeen, clearSeen, describeClearSeen, readSeen, restoredFor, SEEN_CLEAR_ATTEMPTS,
} from './seen-file.ts';
import { HOOK_OPEN_PROFILE, isBusyError, Store } from './store.ts';
import { resolveWorkspace } from './workspace.ts';
import type { Item, Layer } from './types.ts';

/**
 * Which caller asked. `'session-start'` is the SessionStart hook (including
 * its `compact` source); `'manual'` is the `load_context` MCP tool, i.e. the
 * user typing `/LoadMyContext`; `'subagent'` is the SubagentStart hook. They
 * share one implementation on purpose: "what gets injected" must have exactly
 * one answer, and a second copy of
 * this selection is precisely the divergence the single-write-path design
 * exists to prevent.
 *
 * **Where `'subagent'` diverges from `'session-start'`**, gathered here rather
 * than left scattered, because a reader who finds one of these needs to know
 * the others exist (plan `2026-08-20-v2-hooks-sessions-and-continuity.md`
 * Task 9):
 *
 *   1. **Not** in the selection. `select` is called with `'session-start'`,
 *      so a subagent gets the pinned tier in full plus the index — the same
 *      answer, deliberately (design decision 2).
 *   2. The audit record says `op: 'subagent-start'`, `hook: 'SubagentStart'`,
 *      and its note carries `delivery=complete agent=<agentId>`.
 *   3. That record is written **unconditionally**, where every other event
 *      writes one only when something was injected or spilled.
 *   4. The seen file is keyed on `dedupeKey`, and the best-effort index
 *      refresh is skipped.
 *   5. **The rendered text differs**, and only by a prefix: a non-empty
 *      subagent injection opens with `SUBAGENT_PREAMBLE` (Task 10). A block
 *      with no account of where it came from was reported by a real subagent
 *      to its parent as a possible out-of-band attack, which is the correct
 *      reading of unattributed text arriving in a context window. So a
 *      subagent's block is NOT byte-identical to a session start's; the
 *      SELECTION behind it still is, which is what point 1 means and all it
 *      means.
 *   6. **The `/clear` handler never runs on it.** A SubagentStart payload
 *      carries no `source`, so this is a guard rather than a behaviour — but
 *      it is the guard that stops a stray `source` from letting a child wipe
 *      the window state of the parent whose `session_id` it is carrying.
 */
export type InjectionEvent = 'session-start' | 'manual' | 'subagent';

export interface InjectionOptions {
  event?: InjectionEvent;
  /** SessionStart only: startup | clear | resume | compact. */
  source?: string;
  /**
   * The hook payload's `session_id`, and ONLY that. It is the audit record's
   * session — and, on every event but `'subagent'`, the seen file's key too,
   * which is what the PreCompact snapshot and the compaction restore agree
   * on, so a key from any other source silently breaks them. The manual path
   * drops it for that reason (see below), and has no way to supply one
   * anyway: an MCP tool call carries arguments, not session context.
   *
   * **A subagent shares its parent's `session_id`** (`hooks/io.ts` ·
   * `HookInput.agent_id`), and this field stays the PARENT's on that event:
   * `mycontext audit --session <parent>` must group a subagent's delivery
   * under the session it belongs to. What moves to `dedupeKey` is the other
   * job this field used to do alone.
   */
  sessionId?: string;
  /**
   * `'subagent'` only: the seen file's key, when it is not `sessionId`.
   * SubagentStart passes `ledgerKey(input)` — `session_id::agent_id` — and
   * every other caller leaves this unset.
   *
   * **Why it is passed rather than derived.** `ledgerKey` lives in
   * `hooks/io.ts` and `src/core/` does not import from `src/hooks/` (nothing
   * in core does, in either direction of that pair). Composing the key here
   * from `sessionId` and an agent id would put a second spelling of the
   * `::` composite in the module that must agree with `pre-tool-use.ts`
   * byte-for-byte or the subagent's first tool call re-delivers everything it
   * was just given. One spelling, in `ledgerKey`, passed in.
   *
   * **Why it is a separate field rather than a different `sessionId`.** Those
   * are two jobs one string used to do: "which session does this record
   * belong to" and "which file does dedupe state go in". They are the same
   * string for every event but this one, and passing the composite as
   * `sessionId` would file the audit record under a session id that no
   * `mycontext audit --session` query names and hand `readSnapshotMeta` a key
   * no snapshot was ever written under.
   *
   * **There is no fallback to `sessionId` on the subagent event.** An absent
   * key means no seen entry is written at all — disclosed in the audit note —
   * rather than one written under the PARENT's key. That direction is the
   * house rule: writing the parent's file from a subagent suppresses the
   * parent's own JIT tier (`hooks/pre-tool-use.ts` reads that file) and
   * pollutes the PreCompact snapshot with items the parent's window never
   * held, which is a MISS; skipping the entry costs one re-delivery, which is
   * the accepted direction.
   */
  dedupeKey?: string;
  /**
   * `'subagent'` only: the payload's `agent_id`, for the audit note, and for
   * nothing else. `AuditRecord` has no agent field and this does not add one
   * — the note carries `agent=<agentId>` as scope, not content.
   *
   * It is what pairs the `delivery=complete` record this function writes with
   * the `delivery=attempted` record the SubagentStart binary writes BEFORE it
   * (spec §6n.3, design decision 5): an attempt with no completion for the
   * same `agent_id` is a subagent that started with none of this project's
   * knowledge. `dedupeKey` cannot stand in for it — splitting the composite
   * back apart here would be the same second spelling `dedupeKey` exists to
   * avoid.
   */
  agentId?: string;
  /**
   * `parseHookInput`'s reason when the hook payload could not be read, `null`
   * or absent when it could. SessionStart is the only caller that sets it,
   * and deliberately so: it is the one hook with an output channel the model
   * actually reads, and a malformed payload's whole cost lands on what THIS
   * block does and does not contain.
   *
   * It arrives as the raw reason rather than as a rendered line for the same
   * reason `focusState.error` does — the sentence the model reads is composed
   * here, next to everything else that shares this block, so there is one
   * place that decides what an injection says.
   */
  parseError?: string | null;
}

/**
 * The line an injection carries when the hook payload could not be read.
 *
 * The sibling of `focusErrorNote`, and it exists for the same reason: failing
 * open means the session is missing features it cannot see are missing. A
 * SessionStart whose payload was garbage still resolves a workspace (from
 * `process.cwd()`), still loads the corpus, and still injects the pinned tier
 * — so the block below looks complete, and nothing in it hints that `source`
 * and `session_id` never arrived. Without this sentence a lost compaction
 * restore and a silent JIT tier are indistinguishable from "there was nothing
 * to restore" and "no rule applied to that file".
 */
export function hookParseErrorNote(parseError: string | null | undefined): string {
  if (!parseError) return '';
  return (
    `_my_context: the SessionStart hook payload could not be read — ${parseError} — so ` +
    '`source` and `session_id` were not received. This workspace was resolved from the ' +
    'process working directory rather than from the payload; a compaction restore cannot ' +
    'fire for this session and the just-in-time (per-tool-call) tier will inject nothing ' +
    'for the rest of it. Everything else here is an ordinary session start._'
  );
}

/**
 * Removes everything this workspace holds about a context window the user
 * destroyed with `/clear`, and returns ONE non-empty sentence saying what
 * actually went. **Never throws for any filesystem outcome.**
 *
 * Three things are removed, and the third is the one that is not dedupe
 * state: the parent seen file, its `session::agent` siblings (both
 * `clearSeen`), and the restore snapshot at `snapshotPath`. The snapshot is
 * here because it describes a context window rather than a dedupe key — it
 * lists what the DESTROYED window was holding, so a compaction later in the
 * same session would otherwise restore items the new window never held, with
 * nothing in the block to say where they came from.
 *
 * **A FAILED DELETE OVER-INJECTS, WHICH IS THE SAFE DIRECTION** — the same
 * direction `seen-file.ts` takes everywhere. A seen file that will not go
 * suppresses a re-delivery; a snapshot that will not go costs one re-restore.
 * Neither is a miss, and neither may cost the injection. What they may not do
 * is go unsaid, which is what the sentence is for.
 *
 * The sentence is `describeClearSeen`'s, with one clause appended rather than
 * rebuilt: that function already distinguishes "cleared nothing" from
 * "cleared", an unlistable `state/` from an id whose siblings cannot be
 * named, and a file that would not go — and a second spelling of any of those
 * here would be a second spelling that drifts. This module speaks only for
 * the one thing `clearSeen` does not remove.
 */
function clearSessionState(root: string, sessionId: string): string {
  const report = clearSeen(root, sessionId);
  let snapshotClause: string;
  try {
    // `rmSync` WITHOUT `force: true`, for `clearSeen`'s reason: `force`
    // suppresses exactly one thing — ENOENT — and that is the one outcome
    // this sentence must keep separate from success. With it, a session that
    // never compacted would be told its restore snapshot was removed, which
    // is the false-claim half of INV-nothing-is-dropped-silently.
    //
    // The retry budget is the CLEAR's (`SEEN_CLEAR_ATTEMPTS`), deliberately,
    // not the snapshot WRITE's far more patient `SNAPSHOT_RENAME_ATTEMPTS`.
    // A write the product must not lose can afford ~2.1 s of backoff; this
    // runs inside a SessionStart whose `hooks.json` kill is 10 s and whose
    // whole latency budget is 500 ms, and its worst outcome is a re-restore.
    retryOnTransientFsError(() => rmSync(snapshotPath(root, sessionId)), SEEN_CLEAR_ATTEMPTS);
    snapshotClause = 'the restore snapshot for this session was removed too';
  } catch (err) {
    snapshotClause = (err as NodeJS.ErrnoException)?.code === 'ENOENT'
      ? 'no restore snapshot was there to remove'
      : 'the restore snapshot could not be removed ' +
        `(${err instanceof Error ? err.message : String(err)}), so a later compaction in this ` +
        'session may restore items this window never held';
  }
  return `${describeClearSeen(report)}; ${snapshotClause}`;
}

/**
 * The line a cleared window carries into the block the model reads.
 *
 * The sibling of `focusErrorNote` and `hookParseErrorNote`, and it is here for
 * the third time for the same reason: the injected block looks identical
 * whether or not the clear worked, so a window that receives FEWER items than
 * it should — a seen file that would not go still suppresses them — cannot
 * tell that from "there was nothing more to send". `INV-nothing-is-dropped-
 * silently` runs in both directions here, so the audit note and the model get
 * the same sentence rather than the log getting the honest half.
 */
function windowClearedNote(sentence: string): string {
  return (
    '_my_context: this session started from a cleared window, so the delivery state that ' +
    `window had accumulated was cleared with it — ${sentence}._`
  );
}

/**
 * Build the text injected into a session. Never throws: a knowledge base that
 * breaks a session is worse than one that says nothing. Failure returns ''.
 *
 * **The database is not on the injection-critical path** (design §4.3 / B):
 * the corpus is parsed straight from Markdown, `select` is pure over `Item[]`
 * (INV-select-is-pure), and session dedupe state lives in the per-session
 * seen file. The index refresh below is best-effort and disclosed when
 * dropped — a held write lock costs the refresh, never the injection.
 */
export function buildInjection(cwd: string, options: InjectionOptions = {}): string {
  const manual = options.event === 'manual';
  // The SubagentStart event. Read `InjectionEvent`'s docstring first: it names
  // all four places this flag reaches, so a reader who finds one of them here
  // knows there are three more rather than assuming this is the only one.
  const subagent = options.event === 'subagent';
  try {
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    // 1. THE CORPUS, FROM MARKDOWN, PARSED ONCE. No database on the
    // injection-critical path: `select` is pure over Item[] (select.ts,
    // INV-select-is-pure) and loadLayer needs no database. Verified
    // equivalent to select(store.all()) by execution — IDENTICAL in 5/5
    // comparisons on the dogfood corpus, including a tight-budget variant
    // [R1: 2026-08-16 adversarial review] — and it is the cost SessionStart
    // already paid inside rebuild (28.1 ms p95 at 500 items, 15 iterations
    // per size). `select`'s own mergeLayers reproduces the id-PRIMARY-KEY
    // project-over-global resolution the index applied.
    //
    // The per-file LoadErrors are surfaced, not discarded: an item file that
    // fails to parse otherwise vanishes from injection with no signal at all,
    // and this is the highest-traffic path in the product. One concise line,
    // shared with the MCP surface (`loadErrorNote`), and only when there are
    // errors — see the note on that function.
    const errors: LoadError[] = [];
    const roots = rebuildRoots(ws);
    const byLayer: Partial<Record<Layer, Item[]>> = {};
    if (roots.global) byLayer.global = loadLayer(roots.global, 'global', errors, ws.config);
    byLayer.project = loadLayer(ws.projectRoot, 'project', errors, ws.config);
    const items: Item[] = [...(byLayer.global ?? []), ...byLayer.project];

    // The cross-layer duplicate-id check runs HERE, on the critical path,
    // over the layers just parsed — it needs no database (review C1,
    // tasks 5-6). `rebuild` used to be this disclosure's only producer, so
    // discarding its returned errors below silently removed "the project
    // copy wins and the global one is not indexed" from every injection —
    // and a check living only inside the best-effort refresh vanishes
    // exactly when a held lock drops the refresh. It lands in the injected
    // block via `loadErrorNote`, because the model reads THAT mid-task;
    // the audit note carries the colliding ids too (scope, not content).
    const layerFileMap = (list: Item[] | undefined): Map<string, string> | undefined =>
      list && new Map(list.map((i) => [i.id, i.filePath]));
    const collisions = crossLayerCollisions(
      layerFileMap(byLayer.global), layerFileMap(byLayer.project),
    );
    errors.push(...collisions);

    const compacting = options.source === 'compact';
    // The other `source` this function branches on. The value is `'clear'`
    // because that is what `hooks/io.ts` documents and what
    // `hooks/hooks.json`'s matcher already admits — a measurement of a real
    // payload (plan Task 1) would replace this literal, not the branch. The
    // branch is safe under every row of that task's decision table except
    // "SessionStart never fires on /clear", where it is dead code that costs
    // one comparison: a session id that owns no state clears nothing, and
    // `describeClearSeen` says so rather than claiming a clear happened.
    const clearing = options.source === 'clear';
    // The session id is dropped on the manual path, structurally, rather
    // than merely left unset by its one caller — and dropping it is also
    // what neutralizes `compacting` there, since every use of the compact
    // branch below is gated on having a session id.
    //
    // It is dropped because the MCP server has no trustworthy one. Claude
    // Code does set CLAUDE_CODE_SESSION_ID in the server's environment, but
    // on a RESUMED session that value is a freshly-generated id that does
    // NOT match the `session_id` the hooks receive — measured, not assumed:
    // a probe MCP server plus a SessionStart hook under one
    // `claude -p --resume` run reported two different ids for the same
    // session (the hook's matched the resumed session, the server's did
    // not). `params._meta` on tools/call carries only
    // `claudecode/toolUseId` and `progressToken`. Recording under a
    // mismatched key would write dedupe records no restore can ever find,
    // while looking exactly like real records — a silent corruption of
    // the compaction restore. Not recording is the disclosed limitation
    // instead.
    //
    // What that limitation actually costs is SMALLER than this comment used
    // to claim, and the difference is the whole of Phase 1E. It said "items
    // loaded this way are not restored after a compaction". They usually
    // ARE: `buildRestoreSnapshot` unions its delivery records with
    // `scanTranscriptIds`, and a manual load writes every id it delivered
    // into the transcript, so the transcript arm catches what the missing
    // record drops. Executed, not reasoned: a manual `load_context` followed
    // by PreCompact and SessionStart(compact) re-injected the loaded item in
    // full.
    //
    // The recorded arm still matters, because the transcript arm has three
    // holes, each measured the same way: rationale items never restore
    // (`select` filters the restore tier through `isNormative`); an id whose
    // last mention falls outside `readTail`'s final 8MB is not seen; and the
    // restore tier has its own budget, so what does not fit drops to an index
    // line. Hence the corrected wording carried by the tool description,
    // commands/LoadMyContext.md, skills/mycontext/SKILL.md and both READMEs:
    // restored after a compaction ONLY IF the snapshot still sees the id.
    const sessionId = manual ? undefined : options.sessionId;

    // The seen file's key, which is the session id on every event but one.
    //
    // **The subagent event NEVER falls back to `sessionId`.** A subagent
    // shares its parent's `session_id`, so a fallback would write the
    // parent's seen file with items only the subagent received — suppressing
    // the parent's own JIT tier (`pre-tool-use.ts` dedupes against this file)
    // and putting ids the parent's context window never held into the
    // PreCompact snapshot. Both of those are MISSES. Writing nothing costs
    // one re-delivery to that subagent, which is the direction this module
    // accepts everywhere else (see `readSeen`'s contract). The absence is
    // disclosed in the audit note below rather than swallowed.
    //
    // In the other direction, `dedupeKey` is honoured ONLY on the subagent
    // event: a stray key on a session start would file the parent's own
    // deliveries under a name PreCompact and the restore never look at, which
    // is the "recording under a mismatched key" corruption the long comment
    // above rejects for the MCP path.
    const seenKey = subagent ? options.dedupeKey : sessionId;

    // 1b. THE CLEAR. `/clear` destroyed this context window, so everything
    // this workspace holds *about that window* goes with it — the seen files
    // and the restore snapshot (see `clearSessionState`).
    //
    // **It runs BEFORE the seen file is read below, and the order is the
    // whole branch.** Running it after would hand the rest of this function
    // the dedupe state of a window that no longer exists: `readSeen` would
    // return the destroyed window's deliveries and `readSnapshotMeta` would
    // return a snapshot listing what it was holding, so the new, empty window
    // would come up short while the knowledge base believed it was full.
    // That is today's behaviour and the defect this closes.
    //
    // **Gated on a real session id and on neither of the other two events.**
    // `manual` has already dropped its id a few lines up, structurally, so a
    // `/LoadMyContext` can never wipe a live session's state from an MCP tool
    // call whatever `source` it is handed. `subagent` is excluded explicitly,
    // because a SubagentStart payload carries the PARENT's `session_id` and
    // no `source` of its own: a stray one must not let a child destroy the
    // window state of the session that dispatched it. That is the same
    // ordering discipline that tests `subagent` ahead of `compacting` in the
    // `select` call below, and it is here for the same reason.
    //
    // A failed delete over-injects, which is the safe direction; the sentence
    // is what keeps it from being a silent one.
    const clearNote = clearing && !subagent && sessionId !== undefined
      ? clearSessionState(ws.projectRoot, sessionId)
      : null;

    // 2. RESTORE DEDUPE FROM THE SEEN FILE (was: the ledger's rows). The
    // identity-marker semantics carry over unchanged: the restored line is
    // stamped with the snapshot's own capturedAt and compared for EQUALITY,
    // so it matches exactly "this compaction, fired again" — idempotent
    // within one compaction, re-restoring across distinct compactions (see
    // `restoredFor`'s last-line-wins refresh and the long comment there, and
    // `Ledger.recordRestored` for the original reasoning this preserves,
    // including why equality survives a backwards clock step where `>` does
    // not). An UNREADABLE seen file means restore everything and disclose:
    // over-restore, never under (re-injection is the accepted direction).
    const seenState = seenKey ? readSeen(ws.projectRoot, seenKey) : null;
    let restore: string[] = [];
    let snapshotCapturedAt: string | null = null;
    // The snapshot stays PARENT-keyed — `sessionId`, never `seenKey`.
    // PreCompact is a parent-only event by measurement, so a composite key
    // here would look for a snapshot no PreCompact ever wrote, and (worse) a
    // write under one would leave dedupe records no restore can find.
    if (compacting && sessionId) {
      const snapshot = readSnapshotMeta(ws.projectRoot, sessionId);
      if (snapshot) {
        snapshotCapturedAt = snapshot.capturedAt;
        const already = seenState !== null && seenState.error === null
          ? restoredFor(seenState, snapshot.capturedAt)
          : new Set<string>();
        restore = snapshot.itemIds.filter((id) => !already.has(id));
      }
    }

    // `select` treats 'manual' exactly as it treats a session start (pinned
    // tier plus the index), which is the whole point: one selection, one
    // renderer, one output. 'manual' is tested first: a manual load never
    // takes the compact branch, whatever `source` says.
    //
    // **'subagent' is tested next, and selects as a session start** — pinned
    // in full plus the index, which is the decided payload (design decision
    // 2). `SelectEvent` deliberately gains no member: a distinct one would
    // need three new branches in `select` to arrive at the same answer. It is
    // ordered ahead of `compacting` for the same reason 'manual' is: a
    // SubagentStart payload carries no `source`, and a stray one must not
    // turn a subagent's birth injection into a compaction restore keyed on a
    // snapshot that belongs to its parent.
    //
    // **Never `'tool'`.** A tool event returns an empty index, so a subagent
    // would receive the pinned tier and no index at all — half the delivery
    // this event exists for.
    // The focus, read once per injection. `readFocus` never throws: an
    // unreadable focus file must cost the narrowing, never the injection. What
    // it costs is disclosed rather than swallowed — `focusErrorNote` goes into
    // the injected block below, because "your focus is not in effect" is
    // indistinguishable from "you have no focus" unless something says so.
    const focusState = readFocus(ws.projectRoot);

    const selection = select(
      items,
      {
        event: manual ? 'manual' : subagent ? 'session-start'
          : compacting ? 'compact' : 'session-start',
        restore,
        focus: focusState.focus,
      },
      ws.config,
    );

    // Render before recording: rendering reads/walks item data and can in
    // principle throw. If it did after the seen-file append, the outer catch
    // would return '' while the item was already marked seen — a silent
    // drop. Rendering first bounds that risk to the render step itself.
    // The note is appended to whatever renderSelection produced, INCLUDING
    // the empty string: a corpus whose only item file is broken selects
    // nothing, and that is exactly when the signal matters most.
    // The pending-revision queue, on the one surface every session sees.
    //
    // A session that starts with a proposal waiting used to be told nothing at
    // all: the injection lists what governs, and a staged revision governs
    // nothing, so it appeared in no tier and no count. The agent that staged it
    // is a previous session; this one has no way to learn the proposal exists
    // short of a human mentioning it, which is exactly the state that makes
    // staging pointless — the model re-proposes, or reasons about text that is
    // not in force.
    //
    // Appended to whatever `renderSelection` produced, INCLUDING the empty
    // string, for the same reason `loadErrorNote` is: the signal matters most
    // in the corpus that selects nothing. It is deliberately NOT budgeted with
    // the tiers — it is not an item, it is a one-line statement about the
    // workspace, and a budget that could drop it would reintroduce exactly the
    // silence this closes.
    //
    // Its own try/catch: the revision log is a file this function does not
    // otherwise touch, and an unreadable one must cost the note, never the
    // injection. `buildInjection`'s outer catch returns '' — a knowledge base
    // that breaks a session is worse than one that says nothing — and letting
    // a log read reach it would trade the whole injection for this sentence.
    // The corpus is already in hand, so the queue is decorated from `items`
    // rather than a store — the same lookup, no database (see
    // `RevisionViewContext`).
    let revisionNote = '';
    try {
      revisionNote = agentRevisionNotice(
        pendingRevisions({ root: ws.projectRoot, store: null, items, config: ws.config }),
      );
    } catch { /* the note is optional; the injection is not */ }

    const focusError = focusErrorNote(focusState.error);
    // First of the notes: it is the only one that describes the DELIVERY of
    // this injection rather than its content, and it changes how everything
    // after it should be read.
    const parseError = hookParseErrorNote(options.parseError);
    // Second of the delivery-shaped notes, and beside the first for that
    // reason: both describe how this block was produced rather than what is
    // in it, and both change how everything after them should be read.
    const cleared = clearNote === null ? '' : windowClearedNote(clearNote);
    const rendered = renderSelection(selection);
    // **The provenance frame, and the fifth way the subagent event differs**
    // (plan Task 10; the other four are listed on `InjectionEvent`). It is
    // prepended HERE rather than inside the renderer because it is a fact
    // about the DELIVERY — which hook ran, into whose context, at what moment
    // — and the renderer is handed a `Selection`, which knows none of that.
    //
    // **Gated on the selection having rendered something**, not on the event
    // alone. Every sentence in the frame is about the block beneath it, so a
    // frame with nothing beneath it would introduce items that are not there;
    // and an empty corpus already returns '' from here, which is a subagent
    // told nothing rather than a subagent told nothing at length. The notes
    // below can still travel alone, and they are not unattributed when they
    // do: each one names my_context in its own first words.
    //
    // It is NOT counted in `selection.tokens` — see `SUBAGENT_PREAMBLE`. That
    // field is what the selector charged its budgets, and this was never
    // charged to one.
    const output = (subagent && rendered !== '' ? `${SUBAGENT_PREAMBLE}\n\n` : '') +
      rendered +
      (parseError ? `\n${parseError}\n` : '') +
      (cleared ? `\n${cleared}\n` : '') +
      (focusError ? `\n${focusError}\n` : '') +
      (revisionNote ? `\n${revisionNote}\n` : '') +
      loadErrorNote(errors);

    // 3. BEST-EFFORT INDEX REFRESH — off the injection-critical path, dropped
    // without prejudice when the lock is held (HOOK_OPEN_PROFILE bounds the
    // wait to ~1.06 s worst case on the hook path; the manual path is a human
    // waiting on the answer and keeps the default patience, exactly as its
    // store open always has). A stale index costs injections nothing (they no
    // longer read it here) and costs JIT at most a stale-but-consistent read
    // until the next writer lands (WAL snapshot isolation). The corpus is
    // passed preloaded so it is parsed once, not twice (§4.3). The drop is
    // DISCLOSED — an audit note below — never swallowed
    // (INV-nothing-is-dropped-silently).
    //
    // **THE SUBAGENT EVENT SKIPS THIS ENTIRELY** (design decision 3), and it
    // is the ONE caller that does. This block opens the store WRITABLE, with
    // a ~1.06 s contended worst case, and after Task 11 it would run once per
    // subagent dispatch on a hook nothing in-process can cut short. The
    // parent's SessionStart already refreshed the index for this workspace; a
    // subagent adds no new Markdown, so it would re-do that work for an
    // identical result and buy nothing but latency and lock contention on the
    // hottest path this plan creates.
    //
    // **A skip is not a drop, which is why nothing is disclosed here.** The
    // refresh delivers no text to the model and the injection above already
    // read the corpus from Markdown, so no item and no line is lost — there
    // is nothing for INV-nothing-is-dropped-silently to cover. The `refresh
    // dropped` note below is for a refresh that was ATTEMPTED and failed,
    // which is a different fact and must stay distinguishable from this one.
    let refreshNote: string | null = null;
    let store: Store | null = null;
    if (!subagent) {
      try {
        store = Store.open(ws.dbPath, manual ? undefined : HOOK_OPEN_PROFILE);
        // A refresh that RAN can still degrade: an upsert failure leaves the
        // index missing an item the injection itself already delivered from
        // Markdown. Those errors do not touch the injected text, so their
        // surface is the audit note — but they must not be discarded (review
        // C1's second half). Messages already disclosed inline (parse errors
        // via `loadErrorNote`, collisions via the check above — `rebuild`
        // recomputes the same collision messages) are not repeated.
        const refreshErrors = rebuild(store, roots, ws.config, byLayer).errors;
        const disclosedInline = new Set(errors.map((e) => e.message));
        const residual = refreshErrors.filter((e) => !disclosedInline.has(e.message));
        if (residual.length > 0) {
          refreshNote = `index refresh error(s): ${residual.map((e) => e.message).join(' | ')}`;
        }
      } catch (err) {
        refreshNote = `index refresh dropped: ${
          isBusyError(err) ? 'database locked'
            : err instanceof Error ? err.message : String(err)}`;
      } finally {
        try { store?.close(); } catch { /* fail open */ }
      }
    }

    // 4. AUDIT — first and durable (`recordAudit` never throws, and the log
    // is JSONL beside the database, so nothing that stopped the refresh can
    // stop the record) — then the seen-file append.
    //
    // **Scope, not content.** `injected` carries ids and tiers; `spilled`
    // carries ids, tiers and the reason `select` gave. The rendered text is
    // never written here — see the note at the top of `core/audit.ts`.
    //
    // **The INDEX lines are recorded too, at `tier: 'index'`.** They are not a
    // full-text tier, but they are text that reached the model — a session
    // start whose corpus has no `always` item still delivers a list of every
    // normative id — and "what did this session see" is answered wrongly if
    // they are left out. They cost one id each, once per session, and the JIT
    // path never has any (`select` returns an empty index for a tool event).
    //
    // They are NOT dedupe rows: the seen file records the three delivery
    // tiers only, so `ledgerRows` filters this tier back out. Recording them
    // here and replaying them there would make a rebuilt ledger claim
    // deliveries that were never made.
    //
    // A selection that produced nothing at all in any tier records nothing:
    // there is genuinely no event, and a record per empty session start would
    // be the bulk of the log in a workspace with an empty corpus. **Except on
    // the subagent event**, where an empty delivery must still leave a row —
    // the guard below says why.
    const indexRefs: InjectedRef[] = selection.index.normative.map(
      (line) => ({ id: line.id, tier: 'index' }),
    );
    const injected: InjectedRef[] = [
      ...selection.full.map((e): InjectedRef => ({
        id: e.item.id,
        tier: e.tier,
        // Only the restored tier carries its own stamp, and only when a
        // snapshot supplied one — see `InjectedRef.at`. Recording it for
        // every tier would be noise; omitting it for this one would make
        // `ledgerRows` replay a compaction marker that matches no snapshot.
        ...(e.tier === 'restored' && snapshotCapturedAt !== null
          ? { at: snapshotCapturedAt }
          : {}),
      })),
      ...indexRefs,
    ];
    // **An injection under a focus records the focus.** Without this the log
    // shows a session-start that delivered four items and nothing at all about
    // the twelve a focus removed, which answers "what did this session see"
    // with a true list and a false impression. Counts only — the ids are in
    // `.my_context/state/focus.json` and in the injected block, and the log
    // records scope, not content. The same reasoning covers the other notes:
    // a dropped index refresh and a seen file that could not be read are both
    // states a reader of this log needs, and both used to be invisible.
    const noteParts: string[] = [];
    // **The subagent event's half of §6n.3's pair.** The SubagentStart binary
    // writes `delivery=attempted agent=<id>` BEFORE it calls this function,
    // because the only bound on that hook is Claude Code killing the process
    // and a killed process writes nothing after it dies. This is the matching
    // completion. The `agent_id` is what pairs them — `AuditRecord` has no
    // agent field and this does not add one, so the note carries it, as scope
    // and never as content. An `attempted` with no `complete` for the same
    // agent is a subagent that started with none of this project's knowledge.
    //
    // The discriminator lives in the note rather than in a second op on
    // purpose (design decision 5): a `subagent-start-attempt` op would be a
    // third widening of a closed vocabulary whose downgrade cost §6n.5 is
    // still pricing. The cost of that choice, named where it is paid: anything
    // COUNTING `subagent-start` rows counts each dispatch twice unless it
    // reads the note.
    if (subagent) {
      noteParts.push(
        `delivery=complete${options.agentId === undefined ? '' : ` agent=${options.agentId}`}`,
      );
    }
    // Recorded first, and inside the EXISTING `session-start` op rather than
    // behind a new one (`AUDIT_OPS` is closed and `parseAudit` refuses a
    // whole segment on an unknown op). Without it the log shows a
    // `session-start` with no `source=` at all, which reads as "SessionStart
    // sent none" rather than "the payload was garbage and none arrived" —
    // the same false impression the injected block above now closes.
    if (options.parseError) {
      noteParts.push(`hook payload unreadable (${options.parseError}); no source/session_id`);
    }
    if (options.source !== undefined) noteParts.push(`source=${options.source}`);
    // What the clear above actually removed, in the record that already says
    // `source=clear` — ONE record for one event. `clearSeen` deliberately
    // writes none of its own, so this push is the log's only account of it,
    // and it is the same sentence the model was given above rather than a
    // second, quieter one.
    if (clearNote !== null) noteParts.push(clearNote);
    if (selection.focus !== null) {
      noteParts.push(
        `focus hid ${selection.focus.hidden.length}, ` +
        `${selection.focus.dangling.length} load-bearing relation(s) dangling`,
      );
    }
    if (focusState.error !== null) noteParts.push('focus file unreadable, no focus applied');
    if (collisions.length > 0) {
      // Ids only — the full sentence is in the injected block; the log
      // records scope, not content.
      noteParts.push(`cross-layer duplicate id(s): ${collisions.map((c) => c.id).join(', ')}`);
    }
    if (refreshNote !== null) noteParts.push(refreshNote);
    if (seenState !== null && seenState.error !== null) {
      noteParts.push('seen file unreadable; restore dedupe skipped');
    }
    // The subagent event with no `dedupeKey`: nothing was written to any seen
    // file, so this subagent's next PreToolUse will re-deliver what it was
    // just given. A re-delivery is the accepted direction (see `seenKey`), but
    // it is not a silent one.
    if (subagent && seenKey === undefined) {
      noteParts.push('no dedupe key; no seen entry written, delivery not deduplicated');
    }

    const auditAt = new Date().toISOString();
    // **The guard is relaxed for the subagent event, and ONLY for it.**
    // Everywhere else, a selection that produced nothing in any tier records
    // nothing: there is genuinely no event, and a row per empty session start
    // would be the bulk of the log in a workspace with an empty corpus.
    //
    // On `'subagent'` the empty case is not "no event" — it is the difference
    // between two facts §6n.3 exists to keep apart. The SubagentStart binary
    // has already written `delivery=attempted`; if a delivery that carried
    // nothing wrote no completion, an empty corpus and a hook killed
    // mid-selection would leave the IDENTICAL log — one unmatched attempt —
    // and the evidence the whole ordering was built for would be worthless.
    // So the completion is recorded even with `injected` and `spilled` both
    // empty. Do not tighten this back to "something was delivered".
    if (subagent || injected.length > 0 || selection.spilled.length > 0) {
      recordAudit(ws.projectRoot, {
        kind: 'injection',
        // `subagent` is tested before `compacting` for the same reason it is
        // in the `select` call above: the op must name the event that fired.
        op: manual ? 'manual' : subagent ? 'subagent-start'
          : compacting ? 'compact-restore' : 'session-start',
        at: auditAt,
        // The PARENT's id on the subagent event — `mycontext audit --session
        // <parent>` has to show a subagent's delivery beside the session that
        // dispatched it, and beside the `delivery=attempted` row the binary
        // wrote under the same id. The composite is `dedupeKey`'s job.
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(manual ? {} : {
          hook: subagent ? ('SubagentStart' as const) : ('SessionStart' as const),
        }),
        injected,
        // `Selection.tokens`, verbatim — the estimate the budget was spent
        // against, computed at selection time. Never recomputed from the
        // items here or later: recomputation over a corpus that has since
        // moved is exactly the drift this field exists to prevent.
        tokens: selection.tokens,
        ...(selection.spilled.length === 0 ? {} : {
          spilled: selection.spilled.map((s): SpilledRef => ({
            id: s.id, tier: s.tier, reason: s.reason,
          })),
        }),
        ...(noteParts.length === 0 ? {} : { note: noteParts.join('; ') }),
      });
    }

    // 5. THE SEEN-FILE APPEND (was: the ledger write). The restored line
    // carries the snapshot's capturedAt — the identity marker `restoredFor`
    // compares for equality — and every other tier carries the audit
    // instant. `appendSeen` never throws: a failed append is one future
    // re-injection (the accepted direction), never a lost injection —
    // `output` is computed and is returned regardless. The audit record
    // above holds the DELIVERY durably; the failed append itself is not
    // separately disclosed (its whole cost is a disclosed-at-delivery
    // duplicate later, review M1).
    //
    // Keyed on `seenKey`, which is the session id on every event but
    // `'subagent'` — see its definition above for why that event never falls
    // back to the parent's.
    if (seenKey && selection.full.length > 0) {
      appendSeen(ws.projectRoot, seenKey, selection.full.map((e) => ({
        id: e.item.id,
        tier: e.tier,
        at: e.tier === 'restored' && snapshotCapturedAt !== null
          ? snapshotCapturedAt
          : auditAt,
      })));
    }

    return output;
  } catch {
    // Fail open: a knowledge base that breaks a session is worse than one
    // that says nothing. The one failure that used to earn a disclosure here
    // — a locked index — can no longer reach this catch: the critical path
    // above opens no database, and the refresh guards its own open. This
    // catch-all is INV-hooks-fail-open's last resort.
    return '';
  }
}
