import { existsSync } from 'node:fs';
import { Ledger, readSnapshotMeta } from './ledger.ts';
import { loadErrorNote, rebuild } from './rebuild.ts';
import { renderSelection } from './render.ts';
import { select } from './select.ts';
import { Store } from './store.ts';
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
 * Build the text injected into a session. Returns '' rather than throwing:
 * a knowledge base that breaks a session is worse than one that says nothing.
 */
export function buildInjection(cwd: string, options: InjectionOptions = {}): string {
  let store: Store | null = null;
  let ledger: Ledger | null = null;
  try {
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    store = Store.open(ws.dbPath);
    // `rebuild`'s LoadError[] is surfaced, not discarded: an item file that
    // fails to parse otherwise vanishes from injection with no signal at all,
    // and this is the highest-traffic path in the product. One concise line,
    // shared with the MCP surface (`loadErrorNote`), and only when there are
    // errors — see the note on that function.
    const { errors } = rebuild(store, {
      project: ws.projectRoot,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    }, ws.config);

    const manual = options.event === 'manual';
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
    // Plan 2's compaction restore. Not recording is a known, disclosed
    // limitation instead: "items loaded this way are not restored after a
    // compaction", stated in the tool's description and in
    // commands/LoadMyContext.md.
    const sessionId = manual ? undefined : options.sessionId;
    // Store MUST be opened before Ledger: Store.open's corruption self-heal
    // (delete-and-recreate on a genuinely unreadable file) is the only
    // reason a corrupt .index.db is survivable for Ledger.open, which has no
    // self-heal of its own. See the comment on Ledger.open. `store.open`
    // above already ran before this point, so the ordering holds.
    if (sessionId) ledger = Ledger.open(ws.dbPath);

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
    const selection = select(
      store.all(),
      { event: manual ? 'manual' : compacting ? 'compact' : 'session-start', restore },
      ws.config,
    );

    // Render before recording: rendering reads/walks item data and can in
    // principle throw. If it did after the ledger write, the outer catch
    // would return '' while the item was already marked seen — a silent
    // drop. Rendering first bounds that risk to the render step itself.
    // The note is appended to whatever renderSelection produced, INCLUDING
    // the empty string: a corpus whose only item file is broken selects
    // nothing, and that is exactly when the signal matters most.
    const output = renderSelection(selection) + loadErrorNote(errors);

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
    if (ledger && selection.full.length > 0) {
      try {
        const at = new Date().toISOString();
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
  } catch {
    return '';
  } finally {
    try { store?.close(); } catch { /* fail open */ }
    try { ledger?.close(); } catch { /* fail open */ }
  }
}
