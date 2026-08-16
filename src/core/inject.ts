import { existsSync } from 'node:fs';
import { recordAudit, type InjectedRef, type SpilledRef } from './audit.ts';
import { focusErrorNote, readFocus } from './focus.ts';
import { Ledger, readSnapshotMeta } from './ledger.ts';
import { loadErrorNote, rebuild } from './rebuild.ts';
import { renderSelection } from './render.ts';
import { agentRevisionNotice, pendingRevisions } from './revision.ts';
import { select } from './select.ts';
import { HOOK_OPEN_PROFILE, isBusyError, Store } from './store.ts';
import { resolveWorkspace } from './workspace.ts';

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
   * The hook payload's `session_id`, and ONLY that. It is the ledger's key,
   * and the ledger is what the PreCompact snapshot and the compaction restore
   * agree on — so a key from any other source silently breaks them. The
   * manual path drops it for that reason (see below), and has no way to
   * supply one anyway: an MCP tool call carries arguments, not session
   * context.
   */
  sessionId?: string;
}

/**
 * Build the text injected into a session. Never throws: a knowledge base that
 * breaks a session is worse than one that says nothing. Failure returns '' —
 * except a locked index database, which returns a one-line disclosure instead
 * of silence; see the catch at the bottom.
 */
export function buildInjection(cwd: string, options: InjectionOptions = {}): string {
  let store: Store | null = null;
  let ledger: Ledger | null = null;
  // Resolved before the try so the catch can write an audit record: the
  // audit log is JSONL beside the database, so a locked index — the one
  // failure the catch discloses — cannot block the record of itself.
  let auditRoot: string | null = null;
  const manual = options.event === 'manual';
  try {
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';
    auditRoot = ws.projectRoot;

    // The hook profile on the hook path only. The SessionStart hook serves a
    // session that did not ask and that `hooks.json` kills at 10s, so the
    // default policy's ~15–23s contended worst case (measured 16.9s) is not
    // patience, it is a killed process and a silently missing injection. The
    // manual path is a human who just typed /LoadMyContext and is waiting on
    // the answer — it keeps the default patience. See `OpenProfile`.
    store = Store.open(ws.dbPath, manual ? undefined : HOOK_OPEN_PROFILE);
    // `rebuild`'s LoadError[] is surfaced, not discarded: an item file that
    // fails to parse otherwise vanishes from injection with no signal at all,
    // and this is the highest-traffic path in the product. One concise line,
    // shared with the MCP surface (`loadErrorNote`), and only when there are
    // errors — see the note on that function.
    const { errors } = rebuild(store, {
      project: ws.projectRoot,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    }, ws.config);

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
    // mismatched key would write ledger rows no restore can ever find,
    // while looking exactly like a real record — a silent corruption of
    // Plan 2's compaction restore. Not recording is the disclosed limitation
    // instead.
    //
    // What that limitation actually costs is SMALLER than this comment used
    // to claim, and the difference is the whole of Phase 1E. It said "items
    // loaded this way are not restored after a compaction". They usually
    // ARE: `buildRestoreSnapshot` unions the ledger with `scanTranscriptIds`,
    // and a manual load writes every id it delivered into the transcript, so
    // the transcript arm catches what the missing ledger arm drops. Executed,
    // not reasoned: a manual `load_context` followed by PreCompact and
    // SessionStart(compact) re-injected the loaded item in full.
    //
    // The ledger arm still matters, because the transcript arm has three
    // holes, each measured the same way: rationale items never restore
    // (`select` filters the restore tier through `isNormative`); an id whose
    // last mention falls outside `readTail`'s final 8MB is not seen; and the
    // restore tier has its own budget, so what does not fit drops to an index
    // line. Hence the corrected wording carried by the tool description,
    // commands/LoadMyContext.md, skills/mycontext/SKILL.md and both READMEs:
    // restored after a compaction ONLY IF the snapshot still sees the id.
    const sessionId = manual ? undefined : options.sessionId;
    // Store MUST be opened before Ledger: Store.open's corruption self-heal
    // (delete-and-recreate on a genuinely unreadable file) is the only
    // reason a corrupt .index.db is survivable for Ledger.open, which has no
    // self-heal of its own. See the comment on Ledger.open. `store.open`
    // above already ran before this point, so the ordering holds.
    // Only ever opened on the hook path (`sessionId` is dropped for manual
    // above), so it always carries the hook busy timeout.
    if (sessionId) ledger = Ledger.open(ws.dbPath, HOOK_OPEN_PROFILE.busyTimeoutMs);

    // `seen` is deliberately not passed to `select` here: the ledger rows
    // survive compaction but the context they describe does not, and
    // filtering the whole selection by every tier ever seen risks losing
    // restoration entirely for items already shown once (e.g. via JIT)
    // before the compact — precisely the failure this tier exists to
    // prevent. (Items the PreCompact transcript scan found but the ledger
    // never recorded would still restore even under a blanket `seen` filter,
    // but session-wide `seen` is still the wrong tool here.)
    //
    // The dedupe that *is* needed is idempotency for one compaction event —
    // SessionStart(compact) can fire more than once for the same
    // compaction — not suppression across distinct compactions. The
    // discriminator is therefore the compaction's own `capturedAt`, not the
    // session — and it needs only IDENTITY, not clock ORDER: a
    // `restored`-tier row is recorded with `injectedAt` set to the
    // snapshot's own `capturedAt` (see below), so a row matches this
    // snapshot exactly when `injectedAt === capturedAt`. Rows from a
    // previous, separate compaction carry a different `capturedAt` and are
    // left alone, so they restore again — they were live again right up
    // until this compaction just wiped them.
    //
    // Equality, not `>`, deliberately: comparing two independently-sampled
    // wall clocks with `>` breaks under a backwards clock step (NTP
    // correction, VM resume) between one compaction's restore and the next
    // compaction's capture — the earlier compaction's row could sort AFTER
    // the later capturedAt and get wrongly subtracted, silently
    // under-restoring an entire snapshot. Equality has no such failure mode:
    // it only ever matches the exact generation marker this same snapshot
    // wrote. When `capturedAt` is missing (older snapshot format), it
    // degrades to "now" in `readSnapshotMeta`, which still fails safe here —
    // nothing recorded so far can equal it, so nothing is excluded and
    // everything restores.
    let restore: string[] = [];
    let snapshotCapturedAt: string | null = null;
    if (compacting && sessionId) {
      const snapshot = readSnapshotMeta(ws.projectRoot, sessionId);
      if (snapshot) {
        snapshotCapturedAt = snapshot.capturedAt;
        const restoredSinceCapture = new Set(
          ledger!.entries(sessionId)
            .filter((e) => e.tier === 'restored' && e.injectedAt === snapshot.capturedAt)
            .map((e) => e.itemId),
        );
        restore = snapshot.itemIds.filter((id) => !restoredSinceCapture.has(id));
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
      store.all(),
      {
        event: manual ? 'manual' : compacting ? 'compact' : 'session-start',
        restore,
        focus: focusState.focus,
      },
      ws.config,
    );

    // Render before recording: rendering reads/walks item data and can in
    // principle throw. If it did after the ledger write, the outer catch
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
    let revisionNote = '';
    try {
      revisionNote = agentRevisionNotice(
        pendingRevisions({ root: ws.projectRoot, store, config: ws.config }),
      );
    } catch { /* the note is optional; the injection is not */ }

    const focusError = focusErrorNote(focusState.error);
    const output = renderSelection(selection) +
      (focusError ? `\n${focusError}\n` : '') +
      (revisionNote ? `\n${revisionNote}\n` : '') +
      loadErrorNote(errors);

    // The ledger write gets its OWN try/catch, separate from the outer one:
    // it is not inside the same try as the render above, so a `record` /
    // `recordRestored` failure (e.g. SQLITE_BUSY from a concurrent
    // `rebuild` holding the WAL lock past `busy_timeout`) can never fall
    // through to the outer catch and discard `output`, which has already
    // been computed and is safe to return regardless. This matters more
    // here than at JIT: a dropped SessionStart injection is not
    // recoverable later in the session the way a dropped JIT match is on a
    // subsequent matching file read, and the same path also carries the
    // compact restore, whose whole purpose is not losing state.
    // The audit record, written whether or not there is a ledger to write to —
    // that independence is the point. The ledger is skipped entirely on the
    // manual path (no trustworthy session id) and lives inside the disposable
    // `.index.db` on every other path; the audit log is neither, so it is the
    // durable answer to "what did this session see".
    //
    // **Scope, not content.** `injected` carries ids and tiers; `spilled`
    // carries ids, tiers and the reason `select` gave. The rendered text is
    // never written here — see the note at the top of `core/audit.ts`.
    //
    // Written BEFORE the ledger and outside its try/catch, and outside the
    // outer one too (`recordAudit` never throws, by construction), so no
    // failure of the ledger write can cost the audit record and no failure of
    // the audit record can cost the injection.
    //
    // **The INDEX lines are recorded too, at `tier: 'index'`.** They are not a
    // full-text tier, but they are text that reached the model — a session
    // start whose corpus has no `always` item still delivers a list of every
    // normative id — and "what did this session see" is answered wrongly if
    // they are left out. They cost one id each, once per session, and the JIT
    // path never has any (`select` returns an empty index for a tool event).
    //
    // They are NOT ledger rows: `Ledger` records the three delivery tiers only,
    // so `ledgerRows` filters this tier back out. Recording them here and
    // replaying them there would make a rebuilt ledger claim deliveries the
    // live one never made.
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
    // records scope, not content.
    const noteParts: string[] = [];
    if (options.source !== undefined) noteParts.push(`source=${options.source}`);
    if (selection.focus !== null) {
      noteParts.push(
        `focus hid ${selection.focus.hidden.length}, ` +
        `${selection.focus.dangling.length} load-bearing relation(s) dangling`,
      );
    }
    if (focusState.error !== null) noteParts.push('focus file unreadable, no focus applied');

    const auditAt = new Date().toISOString();
    if (injected.length > 0 || selection.spilled.length > 0) {
      recordAudit(ws.projectRoot, {
        kind: 'injection',
        op: manual ? 'manual' : compacting ? 'compact-restore' : 'session-start',
        at: auditAt,
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(manual ? {} : { hook: 'SessionStart' as const }),
        injected,
        ...(selection.spilled.length === 0 ? {} : {
          spilled: selection.spilled.map((s): SpilledRef => ({
            id: s.id, tier: s.tier, reason: s.reason,
          })),
        }),
        ...(noteParts.length === 0 ? {} : { note: noteParts.join('; ') }),
      });
    }

    if (ledger && selection.full.length > 0) {
      try {
        const at = auditAt;
        const restoredIds: string[] = [];
        for (const entry of selection.full) {
          // Restored-tier rows must refresh their timestamp on every restore
          // (recordRestored), not just the first time (record) — see the
          // comment on Ledger.recordRestored for why a frozen timestamp
          // breaks idempotency for a later compaction. They are stamped
          // with the snapshot's own `capturedAt` (falling back to `at` when
          // there is no snapshot, e.g. a non-compact SessionStart), which
          // turns `recordRestored`'s timestamp into a pure identity marker
          // for "this compaction" — see the comment above on `restore`.
          if (entry.tier === 'restored') restoredIds.push(entry.item.id);
          else ledger.record(sessionId!, entry.item.id, entry.tier, at);
        }
        ledger.recordRestored(sessionId!, restoredIds, snapshotCapturedAt ?? at);
      } catch {
        // A failed record must never cost the already-rendered injection.
      }
    }

    return output;
  } catch (err) {
    // Fail open, but not silently. For every failure this catch has always
    // returned '' — a knowledge base that breaks a session is worse than one
    // that says nothing. Contention is the one failure that gets more,
    // because it is the one a reader can act on and the one that used to be
    // invisible twice over: the injection was empty AND nothing anywhere
    // recorded why. The disclosure is a single line into the session (what
    // the model and the user see) plus an audit record with zero injected
    // items (what `mycontext audit` and a human see afterwards) — the E4
    // fix's second half, the first being `HOOK_OPEN_PROFILE` above.
    if (auditRoot === null || !isBusyError(err)) return '';
    // `recordAudit` never throws, and the log is a JSONL file beside the
    // locked database, not inside it.
    recordAudit(auditRoot, {
      kind: 'injection',
      op: manual ? 'manual' : options.source === 'compact' ? 'compact-restore' : 'session-start',
      ...(manual || options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
      ...(manual ? {} : { hook: 'SessionStart' as const }),
      injected: [],
      note: 'index database locked by another process — nothing injected',
    });
    return (
      'my_context: context was NOT injected — the index database is locked by another ' +
      'process (usually another session or command in this workspace; it clears in ' +
      'moments). Load it once the lock clears with /LoadMyContext.'
    );
  } finally {
    try { store?.close(); } catch { /* fail open */ }
    try { ledger?.close(); } catch { /* fail open */ }
  }
}
