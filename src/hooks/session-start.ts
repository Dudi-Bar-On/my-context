import { existsSync } from 'node:fs';
import { Ledger, readSnapshot } from '../core/ledger.ts';
import { isMainEntry } from '../core/paths.ts';
import { rebuild } from '../core/rebuild.ts';
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
    rebuild(store, {
      project: ws.projectRoot,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    }, ws.config);

    const compacting = options.source === 'compact';
    const sessionId = options.sessionId;
    if (sessionId) ledger = Ledger.open(ws.dbPath);

    // `seen` is deliberately not passed to `select` here: the ledger rows
    // survive compaction but the context they describe does not, and
    // filtering the whole selection by every tier ever seen would guarantee
    // nothing is ever restored (e.g. an item shown once via JIT before the
    // compact would then be permanently excluded from the restored tier
    // too). Instead, only the `restored` tier's own prior rows — the ones
    // left by an earlier compact in this same session — are subtracted from
    // the snapshot before selection. `tier` is part of the ledger's primary
    // key precisely so this per-tier check is possible: a second compact in
    // the same session will not re-restore what the first one already
    // restored, without that touching items seen under a different tier.
    let restore: string[] = [];
    if (compacting && sessionId) {
      const snapshot = readSnapshot(ws.projectRoot, sessionId);
      const alreadyRestored = new Set(
        ledger!.entries(sessionId).filter((e) => e.tier === 'restored').map((e) => e.itemId),
      );
      restore = snapshot.filter((id) => !alreadyRestored.has(id));
    }

    const selection = select(
      store.all(),
      { event: compacting ? 'compact' : 'session-start', restore },
      ws.config,
    );

    // Render before recording: if rendering were to throw after the ledger
    // commit, items would be marked seen but never actually injected — a
    // silent drop. Rendering first means the only reachable failure is a
    // duplicate injection later, which is the safe direction.
    const output = renderSelection(selection);

    if (ledger && selection.full.length > 0) {
      const at = new Date().toISOString();
      for (const entry of selection.full) {
        ledger.record(sessionId!, entry.item.id, entry.tier, at);
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
  // session-start latency budget (see test/hooks/session-start.test.ts) is
  // enforced by that performance test, not by a runtime cutoff.
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
