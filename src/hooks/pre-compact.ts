import { Ledger, scanTranscriptIds, writeSnapshot } from '../core/ledger.ts';
import { isMainEntry } from '../core/paths.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { parseHookInput, readStdin, type HookInput } from './io.ts';

/**
 * The union of two independent signals, because each misses what the other
 * catches: the ledger knows what my_context injected, the transcript knows what
 * was cited by id after being fetched some other way. Both are filtered against
 * the live index so a deleted or renamed item is not resurrected.
 */
export function buildRestoreSnapshot(
  input: HookInput, fallbackCwd: string,
): { path: string; itemIds: string[] } | null {
  let store: Store | null = null;
  let ledger: Ledger | null = null;
  try {
    const sessionId = input.session_id;
    if (!sessionId) return null;

    const ws = resolveWorkspace(input.cwd ?? fallbackCwd);
    if (!ws.projectRoot) return null;

    // Store MUST be opened before Ledger: Store.open's corruption self-heal
    // (delete-and-recreate on a genuinely unreadable file) is the only
    // reason a corrupt .index.db is survivable for Ledger.open, which has no
    // self-heal of its own. See the comment on Ledger.open.
    store = Store.open(ws.dbPath);
    ledger = Ledger.open(ws.dbPath);

    const known = new Set(store.ids());
    const fromLedger = ledger.seen(sessionId).filter((id) => known.has(id));
    const fromTranscript = scanTranscriptIds(input.transcript_path, known);
    const itemIds = [...new Set([...fromLedger, ...fromTranscript])].sort();

    return { path: writeSnapshot(ws.projectRoot, sessionId, itemIds), itemIds };
  } catch {
    return null;
  } finally {
    try { store?.close(); } catch { /* fail open */ }
    try { ledger?.close(); } catch { /* fail open */ }
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer here: buildRestoreSnapshot is fully synchronous, so
  // an unref'd setTimeout set before calling it can only ever fire after that
  // call already returned — it cannot preempt synchronous work in between. The
  // real bound is the `hooks.json` timeout.
  try {
    buildRestoreSnapshot(parseHookInput(readStdin()), process.cwd());
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
