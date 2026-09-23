// @basis TASK-the-product-overwrote-the-repository-s-root-gitignore-with-a, INV-nothing-is-dropped-silently
/**
 * **ONE FUNCTION OWNS EVERY `*` `.gitignore` THIS PRODUCT WRITES, AND IT
 * REFUSES A TARGET THAT IS NOT ITS OWN.**
 *
 * ── THE INCIDENT THIS EXISTS FOR ───────────────────────────────────────────
 *
 * **2026-09-23.** The repository's ROOT `.gitignore` — 73 lines, tracked,
 * somebody's file — was found truncated to the two bytes `*` and a newline.
 * The first symptom was `git add reports/V2-HANDOVER.md` refusing with *"The
 * following paths are ignored by one of your .gitignore files: reports"*, at
 * 02:34Z; the file's mtime was 02:31Z. Restored from `HEAD` in commit
 * `5664e55c`. A root `.gitignore` of `*` also stops excluding `node_modules/`,
 * `test-results/` and `.claude/worktrees/`, so the next `git add -A` on that
 * checkout would have committed all three.
 *
 * Twelve call sites wrote that exact line, each spelling
 * `writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8')` by hand into a
 * directory it had just created. Every one of them derived `dir` by joining a
 * FIXED private name onto a corpus root, so none can reach a repository root
 * by path arithmetic alone — it takes a `dir` that is relative (and therefore
 * resolved against a working directory nobody chose), a root handed in that is
 * already the repository, or a directory reached through a link. **Which of
 * the three happened is not what makes the product safe.** Twelve unguarded
 * writers are, and this closes all twelve at once.
 *
 * ── THE FOUR REFUSALS, AND WHY EACH ONE IS THERE ───────────────────────────
 *
 *   1. **A relative `dir` is refused.** `path.join('.', '.gitignore')` is
 *      `.gitignore`, and `writeFileSync` resolves that against `process.cwd()`
 *      — which, for every CLI run and every hook in this repository, is the
 *      repository root. Every legitimate caller has an absolute root already
 *      (`findProjectRoot` resolves, `mkdtempSync` is absolute), so nothing
 *      real is lost and the one shape that silently redirects a write is gone.
 *   2. **The directory must be one of the product's own.** Some segment of the
 *      path — the basename or any ancestor's — has to be a private directory
 *      name this product creates (`PRIVATE_DIR_NAMES`), or the target has to
 *      be under a root the caller NAMED (`allowedRoot`, for the sessions
 *      directory a caller was explicitly given). A repository root has no such
 *      segment, which is exactly the fact that was missing on 2026-09-23.
 *   3. **A directory holding a `.git` is never a private state directory.**
 *      Belt to the braces of (2): it catches a private name that somebody's
 *      repository happens to also use.
 *   4. **A `.gitignore` with rules in it is somebody's file.** The existing
 *      file is read first, and only an absent one, an empty one, or one that
 *      already says `*` is overwritten. This one alone would have stopped the
 *      2026-09-23 damage — the root file had 73 lines — and it keeps the
 *      self-heal the twelve call sites were written for: an emptied or
 *      hand-edited `*` file still repairs itself on the next write, which is
 *      `ensureLogDir`'s stated reason for rewriting unconditionally.
 *
 * ── NOTHING IS DROPPED SILENTLY ────────────────────────────────────────────
 *
 * A refusal returns the sentence AND writes it to stderr
 * (`INV-nothing-is-dropped-silently`). A caller that has a channel of its own
 * may use the returned sentence; a caller that does not — most of these are
 * best-effort writes inside hooks — still leaves a line a person can find. It
 * never throws: a private directory that could not be marked is a disclosure,
 * not a reason to lose the record the caller was about to append.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The whole file, and the only content this function will ever write. */
export const PRIVATE_GITIGNORE_BODY = '*\n';

/**
 * Every directory name this product creates for its own working state.
 *
 * Read as SEGMENTS, not as basenames: `.audit/imported/<pack>/<hash>` and
 * `.staging/restore` are as much this product's as `.audit` and `.staging`
 * are, and `pack/imported-audit.ts` marks every level of that tree
 * deliberately — a `.gitignore` one level up is a fact about the parent, and a
 * directory copied out takes its own with it.
 *
 * **`state` is the one name here that is not dotted**, and therefore the one
 * a repository could plausibly use for something of its own. It is admitted
 * by name and then backstopped twice: refusal (3) turns away anything holding
 * a `.git`, and refusal (4) turns away any `.gitignore` that carries rules. A
 * person's `state/` directory is not damaged by this function; at worst an
 * empty one gains a marker, and that is disclosed.
 *
 * `.my_context` is deliberately ABSENT. The corpus root is a directory a
 * person commits; only what this product puts INSIDE it is private, and
 * `mycontext init` writes that root's own narrow `.gitignore` (three names,
 * not a star) through its own path.
 */
export const PRIVATE_DIR_NAMES: readonly string[] = [
  '.audit', '.drafts', '.ingest', '.revisions', '.rules', '.staging',
  '.statusline', '.verdicts', 'state',
];

/** What the write did, and — when it did nothing — the sentence saying so. */
export interface PrivateGitignoreWrite {
  written: boolean;
  /** `null` exactly when `written` is true. */
  refusal: string | null;
}

/** Whether any segment of `abs` names a directory this product creates. */
function underPrivateName(abs: string): boolean {
  let dir = abs;
  for (;;) {
    if (PRIVATE_DIR_NAMES.includes(path.basename(dir))) return true;
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

/** Whether `abs` is `root` itself or lives under it. */
function within(abs: string, root: string): boolean {
  const rel = path.relative(root, abs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Write (or re-write) the one-line `*` `.gitignore` inside a directory this
 * product created for its own state.
 *
 * `allowedRoot` widens (2) for a caller that was HANDED a directory rather
 * than deriving one — the sessions directory, whose location is an operator's
 * choice and therefore carries no name this module could know. It never
 * widens (3) or (4).
 */
export function writePrivateGitignore(
  dir: string, allowedRoot?: string | null,
): PrivateGitignoreWrite {
  const refuse = (sentence: string): PrivateGitignoreWrite => {
    const line = `my_context: refused to write a \`*\` .gitignore into ${dir} — ${sentence}`;
    // Disclosed rather than swallowed, and on stderr because most callers are
    // hooks with no channel of their own. See the header.
    try { process.stderr.write(`${line}\n`); } catch { /* a lost line is not a lost record */ }
    return { written: false, refusal: line };
  };

  if (typeof dir !== 'string' || dir === '') {
    return refuse('the target directory is empty, so the write would land wherever this '
      + 'process happens to be running.');
  }
  if (!path.isAbsolute(dir)) {
    return refuse('a relative target resolves against the working directory rather than a '
      + 'corpus, which on 2026-09-23 was a repository root.');
  }

  const abs = path.resolve(dir);
  const named = allowedRoot !== undefined && allowedRoot !== null && allowedRoot !== ''
    && path.isAbsolute(allowedRoot) && within(abs, path.resolve(allowedRoot));
  if (!named && !underPrivateName(abs)) {
    return refuse('no part of that path is a directory this product creates '
      + `(${PRIVATE_DIR_NAMES.join(', ')}), so it is somebody else's directory.`);
  }
  if (existsSync(path.join(abs, '.git'))) {
    return refuse('it holds a `.git`, so it is the root of somebody\'s repository and never '
      + 'this product\'s private state.');
  }

  const target = path.join(abs, '.gitignore');
  let existing: string | null = null;
  try {
    existing = readFileSync(target, 'utf8');
  } catch (err) {
    // ENOENT is the ordinary first write. Anything else is a file that IS
    // there and was not read, and overwriting what cannot be read is the
    // exact act this function exists to prevent.
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      return refuse(`its .gitignore exists and could not be read (${
        err instanceof Error ? err.message : String(err)}), so nothing was overwritten.`);
    }
  }
  if (existing !== null && existing.trim() !== '' && existing.trim() !== '*') {
    return refuse('its .gitignore already carries rules, so it is somebody\'s file and not '
      + 'the one-line marker this product writes.');
  }

  try {
    writeFileSync(target, PRIVATE_GITIGNORE_BODY, 'utf8');
  } catch (err) {
    return refuse(`the write failed (${err instanceof Error ? err.message : String(err)}).`);
  }
  return { written: true, refusal: null };
}
