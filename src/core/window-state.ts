import { rmSync } from 'node:fs';
import { snapshotPath } from './ledger.ts';
import { retryOnTransientFsError } from './rebuild.ts';
import { clearSeen, describeClearSeen, SEEN_CLEAR_ATTEMPTS } from './seen-file.ts';

/**
 * Everything this workspace holds *about one context window*, removed, with
 * ONE non-empty sentence saying what actually went. **Never throws for any
 * filesystem outcome.**
 *
 * **Why this is its own module and not a function inside `seen-file.ts`.**
 * That module states its boundary explicitly — `core/seen-file.ts` ·
 * `It removes seen files ONLY. The restore snapshot beside them` · ~281 — and
 * the boundary is load-bearing: `clearSeen` answers "which dedupe state went",
 * which is a question about keys, while the snapshot is a question about a
 * WINDOW. Two callers now decide a window is gone (the `/clear` branch in
 * `core/inject.ts` and the `SessionEnd` hook), so the composite needs one
 * spelling; putting it here keeps that spelling out of the module whose
 * contract says it does not do this.
 *
 * Three things are removed, and the third is the one that is not dedupe
 * state: the parent seen file, its `session::agent` siblings (both
 * `clearSeen`), and the restore snapshot at `snapshotPath`. The snapshot is
 * here because it describes a context window rather than a dedupe key — it
 * lists what the DESTROYED window was holding, so a compaction later under
 * the same id would otherwise restore items the new window never held, with
 * nothing to say where they came from.
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
 *
 * `root` is the `.my_context` directory.
 */
export function clearWindowState(root: string, sessionId: string): string {
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
    // A write the product must not lose can afford ~2.1 s of backoff; both
    // callers of this function run inside a hook with a hard kill measured in
    // seconds — and the `SessionEnd` caller inside 1.5 s of platform abort it
    // cannot raise (`hooks/session-end.ts` · `THE BUDGET IS 1,500 ms` · ~40) —
    // and its worst outcome is a re-restore.
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
