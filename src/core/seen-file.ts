import path from 'node:path';
import { retryOnTransientFsError } from './rebuild.ts';
import { appendJsonlLine, readJsonlFile, type JsonlLogSpec } from './jsonl-log.ts';
import { sanitizeSessionId, type LedgerTier } from './ledger.ts';

// --- The per-session seen file ----------------------------------------------
//
// Session dedupe state, off the database: one `{id, tier, at}` line per
// delivery, appended by the hook that delivered and read back by the next
// hook in the same session. The append is the audit log's own machinery
// (appendJsonlLine / healTornTail — 0.55 ms p95 measured, flat in file size)
// and physically cannot take SQLite's write lock, which is the entire point:
// the 16,881 ms Store.open stall under a held write lock [P4] existed only
// because the hook had a reason to open writable, and this file removes the
// reason.
//
// Failure direction, decided here and relied on by every caller: an
// unreadable seen file means "inject WITHOUT dedupe and disclose" — a
// re-injection, never a miss. readSeen therefore NEVER throws; it returns
// `error` for the caller to disclose. appendSeen never throws either: a
// failed append costs one future re-injection, which is the accepted
// direction, and the audit log (written first) still holds the delivery.

export const SEEN_PROTOCOL = 'mycontext-seen/1';

export interface SeenLine {
  id: string;
  tier: LedgerTier;
  at: string;
}

export interface SeenState {
  lines: SeenLine[];
  error: string | null;
}

const TIERS = new Set<string>(['pinned', 'jit', 'restored']);

export function seenFilePath(root: string, key: string): string {
  return path.join(root, 'state', `${sanitizeSessionId(key)}.seen.jsonl`);
}

function specFor(file: string): JsonlLogSpec {
  return {
    file,
    protocol: SEEN_PROTOCOL,
    validate: (row) => {
      if (typeof row.id !== 'string' || row.id === '') return 'has no usable "id"';
      if (typeof row.tier !== 'string' || !TIERS.has(row.tier)) return 'has no usable "tier"';
      if (typeof row.at !== 'string' || row.at === '') return 'has no usable "at"';
      return null;
    },
    refuse: (line, reason) => new Error(
      `my_context: seen file line ${line} ${reason}. Session dedupe cannot be trusted from ` +
      'this file; the session will inject without dedupe (disclosed) rather than guess.',
    ),
    unreadable: (err) => new Error(
      `my_context: seen file could not be read: ${
        err instanceof Error ? err.message : String(err)}`,
    ),
  };
}

/**
 * Retry attempts per appended line, passed to `retryOnTransientFsError`
 * (which sleeps 20·(attempt+1) ms between attempts): a worst case of
 * 10·5·4 = 200 ms of backoff PER LINE. Unlike `SNAPSHOT_RENAME_ATTEMPTS`
 * this guards a hot path where the worst case scales with the number of
 * items delivered — every line can exhaust its backoff and still succeed —
 * so it deliberately keeps the default hot-path impatience rather than the
 * snapshot's compaction-time patience. Two tests in `seen-file.test.ts`
 * pin two different things: a static band pins this constant's VALUE, and a
 * measured-backoff test (read-only file, transient EPERM/EACCES) pins that
 * appendSeen's EFFECTIVE retry behaviour matches it — so a drifted constant,
 * a drifted `retryOnTransientFsError` default, or a changed backoff formula
 * each redden the suite before the append can drift toward the 10 s hook
 * kill (`hooks.json`).
 */
export const SEEN_APPEND_ATTEMPTS = 5;

/** Never throws. A failed append is one future re-injection, disclosed by the audit trail. */
export function appendSeen(
  root: string, key: string, lines: SeenLine[],
): { written: boolean; error: string | null } {
  if (lines.length === 0) return { written: true, error: null };
  try {
    const file = seenFilePath(root, key);
    const dir = path.dirname(file);
    for (const line of lines) {
      // The same transient-EPERM guard the snapshot rename and writeItem use:
      // a scanner holding the file open for a moment must cost a retry, not
      // a lost dedupe record (design §6 risk 4).
      retryOnTransientFsError(() => appendJsonlLine(dir, file, {
        protocol: SEEN_PROTOCOL, id: line.id, tier: line.tier, at: line.at,
      }), SEEN_APPEND_ATTEMPTS);
    }
    return { written: true, error: null };
  } catch (err) {
    return { written: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Never throws. `error !== null` means the file exists but cannot be trusted;
 * the caller injects without dedupe and DISCLOSES (the re-injection is the
 * accepted direction — a suppression built on a guessed-at seen set is not).
 * `lines` is empty whenever `error` is set: no partial answers.
 */
export function readSeen(root: string, key: string): SeenState {
  try {
    const rows = readJsonlFile(specFor(seenFilePath(root, key)));
    return {
      lines: rows.map((r) => ({
        id: r.id as string, tier: r.tier as LedgerTier, at: r.at as string,
      })),
      error: null,
    };
  } catch (err) {
    return { lines: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Unique ids across all tiers, sorted — the `Ledger.seen` shape. */
export function seenIds(state: SeenState): string[] {
  return [...new Set(state.lines.map((l) => l.id))].sort();
}

/**
 * Ids whose LAST `restored` line carries `at === capturedAt`. Last-line-wins
 * per (id, tier) reproduces `Ledger.recordRestored`'s ON CONFLICT refresh:
 * the marker moves to whichever compaction most recently restored the item,
 * so it keeps matching a repeat firing of the SAME compaction and stops
 * matching an older generation (see the long comment on recordRestored).
 */
export function restoredFor(state: SeenState, capturedAt: string): Set<string> {
  const last = new Map<string, string>();
  for (const line of state.lines) {
    if (line.tier === 'restored') last.set(line.id, line.at);
  }
  const out = new Set<string>();
  for (const [id, at] of last) if (at === capturedAt) out.add(id);
  return out;
}
