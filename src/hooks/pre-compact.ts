import { recordAudit } from '../core/audit.ts';
import { scanTranscriptIds, writeSnapshot } from '../core/ledger.ts';
import { isMainEntry } from '../core/paths.ts';
import { readSeen, seenIds } from '../core/seen-file.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { hookParseErrorLine, parseHookInput, readStdin, type HookInput } from './io.ts';

/**
 * The union of two independent signals, because each misses what the other
 * catches: the per-session seen file knows what my_context injected, the
 * transcript knows what was cited by id after being fetched some other way.
 *
 * Zero SQLite writes, zero blocking SQLite reads (design §4.4 / Task 10):
 * the one database touch left is a best-effort READ-ONLY open for the
 * known-id filter — 0.2 ms under a held write lock [P4], 0 failures in
 * 18,300 contended read-only trials [P6/P6b] — and when even that is
 * unavailable the filter is skipped and the skip disclosed. Over-capture is
 * the safe direction: the restore path re-selects through `select`, and an
 * id matching no live item selects nothing. A MISS is the direction this
 * design forbids, so no failure below may shrink the capture silently.
 */
export function buildRestoreSnapshot(
  input: HookInput, fallbackCwd: string,
): { path: string; itemIds: string[] } | null {
  try {
    const sessionId = input.session_id;
    if (!sessionId) return null;
    const ws = resolveWorkspace(input.cwd ?? fallbackCwd);
    if (!ws.projectRoot) return null;

    // seen set ← the per-session file (parent-keyed: PreCompact is a
    // parent-only event by measurement — E2). Unreadable → empty set,
    // disclosed below: the transcript arm still captures, and under-capture
    // from THIS arm is bounded by that union.
    const seenState = readSeen(ws.projectRoot, sessionId);
    const fromSeen = seenState.error === null ? seenIds(seenState) : [];

    // known filter ← a best-effort READ-ONLY open. Two states skip it, both
    // disclosed: the index cannot be read at all, and the index is EMPTY.
    // The empty case is deliberate and load-bearing (tasks 5-6 review I2):
    // an index that knows zero items cannot tell "deleted" from "never
    // indexed" — SessionStart's refresh is best-effort and a held lock
    // leaves a fresh index empty while real items were delivered from
    // Markdown — so filtering the seen set through it would convert a
    // refresh lag into suppression, the one direction this design forbids.
    // The filter's whole purpose (do not resurrect deleted/renamed ids)
    // only means anything when the index actually knows something.
    let known: Set<string> | null = null;
    let knownSkipReason: string | null = null;
    let store: Store | null = null;
    try {
      store = Store.openReadOnly(ws.dbPath);
      const ids = store.ids();
      if (ids.length === 0) knownSkipReason = 'index empty';
      else known = new Set(ids);
    } catch {
      knownSkipReason = 'index unavailable';
    } finally {
      try { store?.close(); } catch { /* fail open */ }
    }

    const fromLedger = known === null ? fromSeen : fromSeen.filter((id) => known.has(id));
    const fromTranscript = scanTranscriptIds(input.transcript_path, known);
    const itemIds = [...new Set([...fromLedger, ...fromTranscript])].sort();

    // `writeSnapshot` retries the rename against transient Windows sharing
    // violations (an antivirus or indexer holding the target open makes
    // NTFS rename fail EPERM) and throws if it still fails. That throw MUST
    // NOT fall into the outer catch: the snapshot is the one write this
    // product cannot afford to lose silently (`INV-nothing-is-dropped-
    // silently`), so a final failure is disclosed twice — an audit record,
    // because that is where "what happened at the compaction" is answered,
    // and one line on stderr, because the audit record alone leaves the
    // user's next session missing its restore with nothing on screen.
    // Exit stays 0 either way: hooks fail open, and the compaction itself
    // must not be blocked over a lost snapshot.
    let snapshotFile: string;
    try {
      snapshotFile = writeSnapshot(ws.projectRoot, sessionId, itemIds);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const audit = recordAudit(ws.projectRoot, {
        kind: 'hook',
        op: 'pre-compact',
        sessionId,
        hook: 'PreCompact',
        injected: [],
        note:
          `SNAPSHOT WRITE FAILED (${reason}). ${itemIds.length} captured id(s) ` +
          `(${fromLedger.length} from the seen file, ${fromTranscript.length} cited in the ` +
          `transcript) were NOT persisted — this session's restore state will not survive ` +
          `the coming compaction.`,
      });
      process.stderr.write(
        `my_context: the PreCompact restore snapshot could not be written (${reason}); ` +
        `the ${itemIds.length} item(s) in play will not be re-injected after this compaction.` +
        (audit.written
          ? ''
          : ` The audit record for this failure also could not be written (${audit.error}).`) +
        '\n',
      );
      return null;
    }

    // A PreCompact snapshot injects nothing, but it decides what a session
    // gets BACK after compaction — so "which ids were captured, and how many
    // came from each of the two signals" is exactly the kind of scope the log
    // exists to carry. Recorded even when the snapshot is empty: an empty
    // snapshot is the interesting case, because it is the one where a session
    // loses everything across a compaction, and a log that stays silent about
    // it answers "what happened at the compaction" with nothing.
    //
    // `kind: 'hook'`, not `'injection'`: nothing was put in front of the
    // model here. The re-injection that follows is a separate,
    // separately-recorded `compact-restore` at the next SessionStart, and
    // conflating the two would make `ledgerRows` replay a delivery that never
    // happened.
    recordAudit(ws.projectRoot, {
      kind: 'hook',
      op: 'pre-compact',
      sessionId,
      hook: 'PreCompact',
      injected: itemIds.map((id) => ({ id, tier: 'snapshot' })),
      note:
        `${fromLedger.length} from the seen file, ${fromTranscript.length} cited in the ` +
        `transcript, ${itemIds.length} captured` +
        (knownSkipReason === null
          ? ''
          : `; known-id filter skipped (${knownSkipReason} — over-capture is safe)`) +
        (seenState.error === null ? '' : '; seen file unreadable, transcript arm only'),
    });

    return { path: snapshotFile, itemIds };
  } catch {
    return null;
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer here: buildRestoreSnapshot is fully synchronous, so
  // an unref'd setTimeout set before calling it can only ever fire after that
  // call already returned — it cannot preempt synchronous work in between. The
  // real bound is the `hooks.json` timeout.
  try {
    // The disclosure is the whole value here: `buildRestoreSnapshot` returns
    // `null` on a missing `session_id` before it does anything at all, so a
    // malformed payload means no snapshot, no audit record, and — until this
    // line — not one byte anywhere saying the coming compaction would lose
    // everything. Same channel and same fail-open exit 0 as the
    // snapshot-write failure this hook already discloses.
    const { input, parseError } = parseHookInput(readStdin());
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    buildRestoreSnapshot(input, process.cwd());
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
