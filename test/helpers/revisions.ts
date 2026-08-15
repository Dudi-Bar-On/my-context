import { existsSync } from 'node:fs';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { stageRevision, type RevisionChanges, type StageResult } from '../../src/core/revision.ts';
import { updateItem, type MutationContext } from '../../src/core/mutate.ts';
import type { Origin } from '../../src/core/types.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

/** A real `MutationContext` over a workspace on disk, rebuilt from its files. */
function contextFor(cwd: string): { ctx: MutationContext; close(): void } {
  const ws = resolveWorkspace(cwd);
  if (!ws.projectRoot) throw new Error(`no workspace at ${cwd}`);
  const store = Store.open(':memory:');
  rebuild(store, {
    project: ws.projectRoot,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  }, ws.config);
  return { ctx: { root: ws.projectRoot, store, config: ws.config }, close: () => store.close() };
}

/**
 * Stages a revision against a workspace on disk, the way the MCP surface does
 * — a real `MutationContext` over the real files, so the revision log the CLI
 * then reads is the one a real agent's edit would have written.
 *
 * There is deliberately no CLI command that stages a revision: staging is what
 * happens TO an agent's edit under `agentEdits: "review"`, not something a
 * human asks for. Tests that need one therefore call the store, exactly as
 * `updateItem` does.
 */
export function stageIn(
  cwd: string, itemId: string, changes: RevisionChanges, origin: Origin = 'agent',
): StageResult {
  const { ctx, close } = contextFor(cwd);
  try {
    return stageRevision(ctx, itemId, changes, origin);
  } finally {
    close();
  }
}

/**
 * A human's edit landing on an item after a revision was staged against it —
 * the way a revision goes STALE.
 *
 * Through `updateItem` with `origin: 'human'` rather than by rewriting the
 * Markdown file directly, because a hand-written file breaks the item's
 * content checksum and every command then reports a corpus load error that has
 * nothing to do with what the test is about. (Task 7's `mycontext edit` is the
 * command a real human will use; until it exists this is the same call it will
 * make.)
 */
export function humanEdit(cwd: string, itemId: string, body: string): void {
  const { ctx, close } = contextFor(cwd);
  try {
    updateItem(ctx, { id: itemId, body, origin: 'human' });
  } finally {
    close();
  }
}
