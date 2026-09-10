/**
 * **Where a proposal lands, and why it is not `items/`** — `plan:loop seq:3`,
 * design §4 ("Drafts are not committed").
 *
 * `.my_context/items/` is COMMITTED. It is the team's corpus: whatever is in
 * it arrives on the next clone, on every machine, as a file somebody else's
 * `git log` will attribute to this repository. A draft the review pass invented
 * has been read by nobody, so a draft in `items/` is an agent-invented team
 * artefact — which is the one thing §13 exists to prevent, reached by the file
 * layout rather than by the status field.
 *
 * So a review draft is written to `.my_context/.drafts/<type>/<id>.md`, beside
 * `.staging/`, `.revisions/`, `.verdicts/` and `state/` — every one of them a
 * directory of working state that this product creates with a `*` .gitignore
 * inside it. **The same corpus, the same id grammar, the same index**: the file
 * is loaded by `loadLayer` (rebuild.ts) exactly like any other item, it is
 * listed and shown and queried, and `select` never injects it because its
 * status is `draft`. Nothing here is a second store, and promotion is a MOVE
 * plus a status flip rather than a migration.
 *
 * ── WHY A `*` .gitignore RATHER THAN A LINE IN THE ROOT `.gitignore` ───────
 *
 * A workspace is created by `mycontext init` in a directory this repository
 * does not own, so a rule written into THIS repository's `.gitignore` protects
 * exactly one workspace: this one. The `*` file travels with the directory it
 * ignores, which is why every other working-state directory in this product
 * carries one (`ensureLogDir` in jsonl-log.ts states the rule; `ledger.ts`,
 * `revision.ts`, `continuity.ts` and `session-names.ts` each write their own).
 * The three lines below are that pattern inlined rather than imported, for the
 * reason those four callers inline it too: this module is reached from
 * `mutate.ts`, and a core write path that reaches into the log module for a
 * `mkdirSync` acquires an import edge it does not need.
 *
 * **Rewritten on every draft write**, so an emptied or hand-edited .gitignore
 * self-heals — `ensureLogDir`'s stated reason, and it matters more here than
 * there: the failure mode is not a missing log, it is a proposal nobody
 * approved arriving in somebody else's checkout.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The directory, relative to the corpus root. **Read by `loadLayer` as a
 * second walk root** — that is the whole of what makes a draft a first-class
 * item rather than a file in a folder.
 */
export const DRAFT_DIR = '.drafts';

/** `Item.filePath` for a draft. The `items/` form's shape, one segment over. */
export function draftFilePath(type: string, id: string): string {
  return `${DRAFT_DIR}/${type}/${id}.md`;
}

/**
 * Whether a root-relative POSIX `filePath` names a draft.
 *
 * The trailing `/` is load-bearing: without it a directory named `.draftsish`
 * would answer true, and the answer decides whether a file is offered to git.
 */
export function isDraftFilePath(filePath: string): boolean {
  return filePath.startsWith(`${DRAFT_DIR}/`);
}

/**
 * Create `<root>/.drafts/` and (re)write its `*` .gitignore. Returns the
 * absolute directory.
 *
 * Called on the write path rather than at `init`, deliberately: a workspace
 * that never turns the review loop on never grows the directory, and a
 * workspace that was created before this build existed grows it on the first
 * proposal instead of needing a migration.
 */
export function ensureDraftDir(root: string): string {
  const dir = path.join(root, DRAFT_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');
  return dir;
}
