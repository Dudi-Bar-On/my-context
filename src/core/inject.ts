import { recordAudit, type InjectedRef, type SpilledRef } from './audit.ts';
import { focusErrorNote, readFocus } from './focus.ts';
import { readSnapshotMeta } from './ledger.ts';
import { rebuildRoots } from './open-store.ts';
import {
  crossLayerCollisions, loadErrorNote, loadLayer, rebuild, type LoadError,
} from './rebuild.ts';
import { renderSelection } from './render.ts';
import { agentRevisionNotice, pendingRevisions } from './revision.ts';
import { select } from './select.ts';
import { appendSeen, readSeen, restoredFor } from './seen-file.ts';
import { HOOK_OPEN_PROFILE, isBusyError, Store } from './store.ts';
import { resolveWorkspace } from './workspace.ts';
import type { Item, Layer } from './types.ts';

/**
 * Which caller asked. `'session-start'` is the SessionStart hook (including
 * its `compact` source); `'manual'` is the `load_context` MCP tool, i.e. the
 * user typing `/LoadMyContext`. They share one implementation on purpose:
 * "what gets injected" must have exactly one answer, and a second copy of
 * this selection is precisely the divergence the single-write-path design
 * exists to prevent.
 */
export type InjectionEvent = 'session-start' | 'manual';

export interface InjectionOptions {
  event?: InjectionEvent;
  /** SessionStart only: startup | clear | resume | compact. */
  source?: string;
  /**
   * The hook payload's `session_id`, and ONLY that. It is the seen file's key,
   * and the seen file is what the PreCompact snapshot and the compaction
   * restore agree on — so a key from any other source silently breaks them.
   * The manual path drops it for that reason (see below), and has no way to
   * supply one anyway: an MCP tool call carries arguments, not session
   * context.
   */
  sessionId?: string;
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
    const seenState = sessionId ? readSeen(ws.projectRoot, sessionId) : null;
    let restore: string[] = [];
    let snapshotCapturedAt: string | null = null;
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
    // The focus, read once per injection. `readFocus` never throws: an
    // unreadable focus file must cost the narrowing, never the injection. What
    // it costs is disclosed rather than swallowed — `focusErrorNote` goes into
    // the injected block below, because "your focus is not in effect" is
    // indistinguishable from "you have no focus" unless something says so.
    const focusState = readFocus(ws.projectRoot);

    const selection = select(
      items,
      {
        event: manual ? 'manual' : compacting ? 'compact' : 'session-start',
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
    const output = renderSelection(selection) +
      (parseError ? `\n${parseError}\n` : '') +
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
    let refreshNote: string | null = null;
    let store: Store | null = null;
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
    // be the bulk of the log in a workspace with an empty corpus.
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

    const auditAt = new Date().toISOString();
    if (injected.length > 0 || selection.spilled.length > 0) {
      recordAudit(ws.projectRoot, {
        kind: 'injection',
        op: manual ? 'manual' : compacting ? 'compact-restore' : 'session-start',
        at: auditAt,
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(manual ? {} : { hook: 'SessionStart' as const }),
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
    if (sessionId && selection.full.length > 0) {
      appendSeen(ws.projectRoot, sessionId, selection.full.map((e) => ({
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
