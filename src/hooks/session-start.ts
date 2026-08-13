import { existsSync } from 'node:fs';
import { Ledger, readSnapshotMeta } from '../core/ledger.ts';
import { isMainEntry } from '../core/paths.ts';
import { loadErrorNote, rebuild } from '../core/rebuild.ts';
import { renderSelection } from '../core/render.ts';
import { select } from '../core/select.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { parseHookInput, readStdin } from './io.ts';

export interface SessionStartOptions {
  /** startup | clear | resume | compact */
  source?: string;
  sessionId?: string;
}

/**
 * Build the text injected at SessionStart. Returns '' rather than throwing:
 * a knowledge base that breaks a session is worse than one that says nothing.
 */
export function buildSessionStartOutput(
  cwd: string, options: SessionStartOptions = {},
): string {
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

    const compacting = options.source === 'compact';
    const sessionId = options.sessionId;
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

    const selection = select(
      store.all(),
      { event: compacting ? 'compact' : 'session-start', restore },
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

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer here: buildSessionStartOutput is fully
  // synchronous, so a timer set before calling it can only ever fire during
  // the stdout drain that follows — where its sole reachable effect would be
  // truncating already-computed, already-safe injected context. The 500ms
  // session-start latency budget (see
  // test/perf/session-start-latency.perf.ts) is enforced by that
  // performance test, not by a runtime cutoff.
  try {
    const input = parseHookInput(readStdin());
    const text = buildSessionStartOutput(input.cwd ?? process.cwd(), {
      source: input.source,
      sessionId: input.session_id,
    });
    if (text) process.stdout.write(text);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
