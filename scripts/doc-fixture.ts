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
 * True for a path the fixture may hold on a maintainer's disk but must never
 * carry into a materialized workspace: state some command DERIVED, rather
 * than corpus a supported surface wrote.
 *
 * `.index.db` (with its `-wal`/`-shm` siblings) is disposable by design
 * (INV-markdown-is-the-source-of-truth) and is rebuilt below. `.ingest` and
 * `.staging` are the same class of thing and are the reason this is a list
 * rather than one check: the fixture now carries a source document and two
 * candidate payloads, so running `mycontext ingest` or `lesson-stage` inside
 * `test/fixtures/docs-workspace` — the obvious thing to do while writing the
 * walkthroughs — leaves a session or a staging file behind. Copied into every
 * example's workspace, an already-applied session makes `mycontext ingest`
 * report a document with nothing left to extract, and the generated block
 * would be a fact about the maintainer's disk rather than about the fixture.
 *
 * **`.audit/` and `state/` are the same class of thing, measured 2026-09-22
 * (release/14).** Neither directory is committed at all — `git show
 * HEAD:test/fixtures/docs-workspace/.my_context/.audit/.gitignore` (and the
 * `state` equivalent) both answer "exists on disk, but not in 'HEAD'". The
 * `*` `.gitignore` inside each is written by THIS PROJECT'S OWN RUNTIME the
 * first time it creates the directory — `ensureLogDir` for `.audit`
 * (`src/core/audit.ts`), `core/ledger.ts` and `core/continuity.ts` for
 * `state/` — the same self-writing convention `core/drafts.ts` documents for
 * every other working-state directory this product makes; nobody committed
 * it and no supported surface treats it as corpus. A real Claude Code
 * session that touches a file under this checkout's own
 * `test/fixtures/docs-workspace` (reading it while writing a walkthrough,
 * say) fires `PreToolUse` and leaves exactly that behind: an
 * `.audit/audit.jsonl` injection record and a matching `state/*.seen.jsonl`,
 * both gitignored the moment the directory first exists and both absent
 * from a fresh clone. `cpSync` above copied them anyway — nothing before
 * this filtered them out — so `ledger.sessionCount()` (`src/core/ledger.ts`)
 * read one real session on the generating machine's own disk and zero
 * everywhere else: the committed `mycontext status` block said "1
 * session(s) recorded" and a fresh clone's fixture run said "none".
 * `test/docs/examples.test.ts` proves the fix by planting a stray segment in
 * this exact fixture directory and asserting `runExampleInFixture('status')`
 * does not move. The filter below still copies each directory's own
 * `.gitignore` — the one name inside `.audit`/`state` it does NOT treat as
 * derived — so that a materialized fixture that later runs a hook of its
 * own does not re-commit its own state.
 */
export function isDerivedFixtureState(source: string): boolean {
  const name = path.basename(source);
  if (name.startsWith('.index.db') || name === '.ingest' || name === '.staging') return true;
  if (name === '.gitignore') return false;
  const parent = path.basename(path.dirname(source));
  return parent === '.audit' || parent === 'state';
}

/**
 * Copies the committed documentation fixture into `dest` and rebuilds its
 * index, so every documented example runs against one known corpus.
 *
 * The index is rebuilt rather than committed because `.index.db` is disposable
 * by design (INV-markdown-is-the-source-of-truth) and a committed binary would
 * drift from the Markdown that defines it. Any index found in the source tree
 * — left behind by running a command inside the fixture directory itself — is
 * skipped rather than copied, so a stale one can never be what an example is
 * generated from. `isDerivedFixtureState` above names everything skipped for
 * that reason, ingest sessions and lesson staging included.
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
    filter: (source) => !isDerivedFixtureState(source),
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
