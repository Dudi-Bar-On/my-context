import { existsSync } from 'node:fs';
import { isMainEntry } from '../core/paths.ts';
import { rebuild } from '../core/rebuild.ts';
import { renderSelection } from '../core/render.ts';
import { select } from '../core/select.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';

/**
 * Build the text injected at SessionStart. Returns '' rather than throwing:
 * a knowledge base that breaks a session is worse than one that says nothing.
 */
export function buildSessionStartOutput(cwd: string): string {
  let store: Store | null = null;
  try {
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    store = Store.open(ws.dbPath);
    rebuild(store, {
      project: ws.projectRoot,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    });

    return renderSelection(select(store.all(), { event: 'session-start' }, ws.config));
  } catch {
    return '';
  } finally {
    try { store?.close(); } catch { /* fail open */ }
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const timer = setTimeout(() => process.exit(0), 200);
  timer.unref();
  try {
    const text = buildSessionStartOutput(process.cwd());
    if (text) process.stdout.write(text);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
