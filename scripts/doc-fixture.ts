import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuild } from '../src/core/rebuild.ts';
import { Store } from '../src/core/store.ts';
import { DIR_NAME, resolveWorkspace } from '../src/core/workspace.ts';

/**
 * The committed documentation fixture: a `.my_context` workspace for a
 * fictional "Bookstore API", plus the handful of source files its scope globs
 * point at. The source files are part of the fixture, not decoration — half
 * of `doctor`'s checks and every scope-activation example are answers about
 * files, and a workspace with no files makes `doctor` report three dead scope
 * globs on a corpus that is in fact healthy.
 *
 * Every item under it was created through the shipped surfaces — `mycontext
 * init`/`add`/`review promote`/`supersede`, and the MCP `create_item` tool for
 * the two agent-authored drafts — so every checksum was computed by the code
 * that computes them at runtime. Nothing here was hand-written, which is the
 * only way the fixture can serve as the oracle a drift test compares against:
 * a hand-stamped checksum that disagrees with its content is precisely what
 * `doctor` exists to catch.
 */
const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'docs-workspace');

/**
 * Copies the committed documentation fixture into `dest` and rebuilds its
 * index, so every documented example runs against one known corpus.
 *
 * The index is rebuilt rather than committed because `.index.db` is disposable
 * by design (INV-markdown-is-the-source-of-truth) and a committed binary would
 * drift from the Markdown that defines it. Any index found in the source tree
 * — left behind by running a command inside the fixture directory itself — is
 * skipped rather than copied, so a stale one can never be what an example is
 * generated from.
 *
 * Only the PROJECT layer is rebuilt. The CLI folds in `~/.my-context` when it
 * exists, which is correct for a user's own workspace and wrong here: whether
 * the machine generating an example block happens to have a global layer would
 * otherwise decide what the documentation shows.
 */
export function materializeDocFixture(dest: string): void {
  if (!existsSync(FIXTURE)) throw new Error(`my_context: doc fixture missing at ${FIXTURE}`);

  cpSync(FIXTURE, dest, {
    recursive: true,
    filter: (source) => !path.basename(source).startsWith('.index.db'),
  });

  const ws = resolveWorkspace(dest);
  const root = path.join(dest, DIR_NAME);
  if (ws.projectRoot !== root) {
    throw new Error(
      `my_context: materialized fixture at ${dest} resolved to workspace ${ws.projectRoot}. ` +
      `A .my_context directory in an ancestor of ${dest} shadows it.`,
    );
  }

  const store = Store.open(ws.dbPath);
  try {
    const { errors } = rebuild(store, { project: root }, ws.config);
    if (errors.length > 0) {
      throw new Error(
        `my_context: the documentation fixture does not load cleanly — ` +
        `${errors.length} error(s), starting with ${errors[0].file}: ${errors[0].message}`,
      );
    }
  } finally {
    store.close();
  }
}
