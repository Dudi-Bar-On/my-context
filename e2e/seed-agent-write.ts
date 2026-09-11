// @basis INSTR-testing-happens-against-the-current-corpus-and-an-exception, TASK-the-browser-suite-returns-to-the-real-corpus-and-the, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **ONE agent-origin edit, made into a THROWAWAY workspace, as a child.**
 *
 * ── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────
 *
 * A pending REVISION is the one state in this corpus that no `mycontext`
 * command can produce. `src/cli/commands/edit.ts` builds every patch as
 * `{ id, origin: 'human' }` — it says so on its own line 618 — and
 * `updateItem`'s staging branch is guarded on `origin !== 'human'`
 * (`src/core/mutate.ts`, "`agentEditsFor` fails closed to `review`"). So a
 * human at a terminal APPLIES an edit and an agent's edit is HELD; there is no
 * flag that makes the terminal behave like the agent, and adding one to ship
 * so a test could use it would be a product change made for a test.
 *
 * The MCP surface is the thing that stages: `src/mcp/tools.ts` passes
 * `origin: 'agent'` itself, deliberately and in four places, "which is what
 * the draft/active trust boundary rests on". This file makes exactly that call
 * and nothing else — the same `updateItem`, the same `origin`, the same
 * refusals — so a spec that needs a pending revision gets one the way the
 * product makes one, rather than by appending a line to `revisions.jsonl` and
 * hoping the shape is right.
 *
 * ── WHY A CHILD PROCESS AND NOT AN IMPORT ─────────────────────────────────
 *
 * `openRebuiltStore` rebuilds the whole corpus and holds a `node:sqlite`
 * handle. Called inside a Playwright worker that then tries to `rmSync` the
 * workspace, Windows refuses the delete for as long as that handle is open —
 * and `e2e/scratch-corpus.ts`'s `dispose` already swallows exactly that
 * failure, so an in-process open would turn every seeded test into a leaked
 * copy of a 1,085-item corpus in `%TEMP%`. A child exits, and the handle goes
 * with it.
 *
 * ── IT REFUSES TO RUN ANYWHERE BUT A THROWAWAY ────────────────────────────
 *
 * The whole point of the owner's exception is that the real corpus is never
 * touched, so this script will not write into it: the workspace it is given
 * must not be this repository. That is a check on the ARGUMENT rather than a
 * promise in a comment, and `e2e/scratch-seeds.spec.ts` drives it.
 *
 * Usage: `node e2e/seed-agent-write.ts <workspace-root> <item-id> <summary>`
 */
import path from 'node:path';
import { resolveWorkspace } from '../src/core/workspace.ts';
import { openRebuiltStore } from '../src/core/open-store.ts';
import { updateItem } from '../src/core/mutate.ts';

/** This repository, which this script exists in order NOT to write to. */
const REPO = path.resolve(import.meta.dirname, '..');

export function seedAgentRevision(root: string, itemId: string, summary: string): string {
  if (path.resolve(root) === REPO) {
    throw new Error(
      'seed-agent-write: refusing to stage a revision into this repository\'s own corpus. '
      + 'The owner\'s exception covers a THROWAWAY COPY that is written to and deleted; '
      + 'writing here would put a pending revision in the project\'s real review queue.',
    );
  }
  const ws = resolveWorkspace(root);
  if (ws.projectRoot === null) {
    throw new Error(`seed-agent-write: ${root} holds no .my_context to write into.`);
  }
  const opened = openRebuiltStore(ws);
  try {
    const result = updateItem(
      { root: ws.projectRoot, store: opened.store, config: ws.config },
      { id: itemId, summary, origin: 'agent' },
    );
    return result.message;
  } finally {
    opened.store.close();
  }
}

if (process.argv[1] !== undefined && import.meta.filename === path.resolve(process.argv[1])) {
  const [root, itemId, summary] = process.argv.slice(2);
  if (root === undefined || itemId === undefined || summary === undefined) {
    throw new Error('usage: node e2e/seed-agent-write.ts <workspace-root> <item-id> <summary>');
  }
  process.stdout.write(seedAgentRevision(root, itemId, summary));
}
