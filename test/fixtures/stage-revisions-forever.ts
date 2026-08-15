/**
 * Stages revisions against one item in a tight loop, reporting each one on
 * stdout as soon as the append returns, until the parent kills it.
 *
 * The point is the kill: a `SIGKILL`/`TerminateProcess` lands wherever it
 * lands, including part-way through `appendFileSync`, which is the one failure
 * an append-only log exists to survive. Every id printed here was appended
 * before the process died, so the parent can assert that not one of them was
 * lost — and that whatever the kill left behind does not wedge the log.
 *
 * Usage: node stage-revisions-forever.ts <cwd> <itemId>
 */
import { rebuild } from '../../src/core/rebuild.ts';
import { stageRevision } from '../../src/core/revision.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const [cwd, itemId] = process.argv.slice(2);

const ws = resolveWorkspace(cwd);
const store = Store.open(':memory:');
rebuild(store, { project: ws.projectRoot! }, ws.config);
const ctx = { root: ws.projectRoot!, store, config: ws.config };

for (let n = 0; ; n++) {
  const result = stageRevision(ctx, itemId, { body: `proposal number ${n}` }, 'agent');
  process.stdout.write(`${result.revision.revisionId}\n`);
}
