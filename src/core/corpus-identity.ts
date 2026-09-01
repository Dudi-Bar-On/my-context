/**
 * **Which corpus this answer came from, said out loud.**
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────
 *
 * `findProjectRoot` walks UP from a working directory and stops at the first
 * `.my_context` it finds. That is the right rule and it is not changed here.
 * What it means, though, is that the working directory alone decides which
 * corpus a process reads — and on 2026-08-27 this repository turned out to hold
 * two:
 *
 *     <root>/.my_context                736 item files    the project's corpus
 *     <root>/my-context/.my_context      44 item files    the plugin's fixtures
 *
 * Subagents dispatched with a `cwd` inside `my-context/` were injected with
 * ~1,582 tokens out of the nested corpus instead of the ~20,587 the real one
 * holds, and their `subagent-start` audit rows landed in the nested log — so
 * the status bar, which reads the real corpus, never saw them and went on
 * showing a previous `subagent-stop`. Every one of those agents worked from a
 * corpus nobody chose, and NOTHING ANYWHERE NAMED IT. A short injection is
 * indistinguishable from a small project until the root is on the page.
 *
 * ── WHAT IS DISCLOSED, AND WHAT IS NOT DECIDED ──────────────────────────────
 *
 * Two separate facts, and they are separate on purpose:
 *
 *   `corpusRootLine`     the absolute root that was resolved. ALWAYS true,
 *                        always cheap, and it is the whole fix for the case
 *                        above — a reader comparing it against the corpus they
 *                        meant needs no second step and no second tool call.
 *   `nestedCorpusNote`   the loud one, and only when the walk stopped at a
 *                        corpus that has ANOTHER corpus above it.
 *
 * The second one does not refuse, does not fall back and does not override the
 * resolution. A process that silently switched corpora on this signal would be
 * a worse version of the same defect — the answer would still come from a
 * corpus nobody chose, just a different one — and `CORPUS_DIR_ENV` exists
 * precisely so a caller can state the choice. So it says both paths, both
 * counts, and how to change it, and then it gets out of the way.
 *
 * **An explicit `MYCONTEXT_CORPUS_DIR` never triggers the loud note**, and that
 * is the same reasoning one level on: the note's whole claim is "the working
 * directory chose this for you". When the variable is set, a caller chose it by
 * name — `ui/execute-effect.ts` points it at a scratch copy on every confirm —
 * and warning about a deliberate choice is how a disclosure trains its reader
 * to dismiss it. The root is still named; only the alarm is withheld.
 *
 * ── WHY "AN ENCLOSING CORPUS", NOT "THE GIT ROOT" ───────────────────────────
 *
 * The obvious spelling of "the project root" is the repository, and it is wrong
 * here in the most direct way possible: in the tree that produced this defect
 * BOTH directories are git repositories, so a git-derived answer would have
 * called the nested corpus the project root and said nothing at all.
 *
 * So the comparison is made from the one walk that is already authoritative.
 * `enclosingCorpus` continues the SAME upward walk past the corpus that was
 * resolved and reports the OUTERMOST `.my_context` above it. Nothing new is
 * consulted, no second notion of "the project" is introduced, and the fact
 * stated is exactly the fact that matters: your walk stopped early, and here is
 * where it would have ended.
 *
 * The honest residual: a person who keeps a corpus in their home directory and
 * a corpus in a project below it gets this note on the project, forever. That
 * is a true statement about their tree and it costs them one paragraph they can
 * read once and ignore; the alternative — a heuristic guessing which nesting is
 * intentional — would be silent in exactly the case it was built for.
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CORPUS_DIR_ENV, DIR_NAME, findProjectRoot } from './workspace.ts';

export interface CorpusResolution {
  /** The absolute `.my_context` this `cwd` resolves to, or `null` when there is none. */
  root: string | null;
  /** `true` when `CORPUS_DIR_ENV` named the root rather than the walk finding it. */
  overridden: boolean;
  /**
   * Set ONLY when the walk stopped at a corpus that has another one above it —
   * `null` is the ordinary case and means there is nothing to warn about.
   *
   * The counts live in here rather than beside `root` because they are needed
   * in exactly one sentence: the wrong-corpus note, where the whole point is
   * that 44 and 736 sit side by side. Counting is a recursive directory walk,
   * and the line that names the root rides on EVERY MCP tool result — so a
   * count kept there would put a walk of the corpus on every tool call to
   * decorate a path the reader is comparing by name.
   */
  nesting: {
    /** The outermost `.my_context` strictly above `root`. */
    enclosing: string;
    /** Item files under `root/items`. */
    items: number;
    /** Item files under `enclosing/items`. */
    enclosingItems: number;
  } | null;
}

/** What a `.md` count could not be taken over. Rendered as words, never as 0. */
const UNREADABLE = -1;

/**
 * Item files as a READER would count them: every `.md` under `items/`,
 * recursively, because the category subdirectories are an implementation detail
 * of the layout and not of the number.
 *
 * Deliberately not `loadLayer`'s count. This is a disclosure printed beside a
 * path so two corpora can be told apart at a glance, and parsing every file to
 * produce it would put the injection-critical path's whole cost onto a note. A
 * file that fails to parse still counts here, which is correct for the question
 * being asked — "how much is in that directory" — and `loadErrorNote` is what
 * already answers the other one.
 */
function countItems(root: string): number {
  let found = 0;
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(path.join(dir, entry.name));
      else if (entry.name.endsWith('.md')) found += 1;
    }
  };
  try {
    visit(path.join(root, 'items'));
  } catch {
    // A corpus with no `items/` yet, a permission, a mount that went away. The
    // count is the decoration; the PATH is the disclosure, and it is already in
    // hand. Never a throw, because every caller of this module is on a path
    // that must not break for a note.
    return UNREADABLE;
  }
  return found;
}

/**
 * The outermost `.my_context` strictly above `root`'s parent, or `null`.
 *
 * Outermost rather than next-one-up: three nested corpora is the same defect
 * with more steps, and the reader wants the one they almost certainly meant.
 */
function enclosingCorpus(root: string): string | null {
  let dir = path.dirname(path.dirname(root));
  let outermost: string | null = null;
  for (;;) {
    const candidate = path.join(dir, DIR_NAME);
    if (existsSync(candidate)) outermost = candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return outermost;
    dir = parent;
  }
}

/**
 * Resolve the corpus for `cwd` and describe it.
 *
 * `override` is a parameter for the reason `findProjectRoot`'s is: a caller can
 * ask what a different environment would resolve to without mutating its own.
 */
export function resolveCorpus(
  cwd: string,
  override: string | undefined = process.env[CORPUS_DIR_ENV],
): CorpusResolution {
  const overridden = override !== undefined && override !== '';
  const root = findProjectRoot(cwd, override);
  if (root === null) return { root: null, overridden, nesting: null };
  // The enclosing walk is skipped under an override, not merely unreported:
  // there is no "walk that stopped early" to describe when no walk happened.
  const enclosing = overridden ? null : enclosingCorpus(root);
  return {
    root,
    overridden,
    nesting: enclosing === null
      ? null
      : { enclosing, items: countItems(root), enclosingItems: countItems(enclosing) },
  };
}

/** `736 item files`, or words when the directory could not be read. */
function countPhrase(count: number): string {
  if (count === UNREADABLE) return 'an items/ directory that could not be read';
  return `${count} item file${count === 1 ? '' : 's'}`;
}

/**
 * One line naming the corpus this answer came from. Never empty when there is a
 * corpus, because a surface that names the root only SOMETIMES is one whose
 * silence a reader has to interpret.
 *
 * It carries no count, and that is the reason directly above: it rides on every
 * MCP tool result, so it must cost one upward `existsSync` walk and nothing
 * more. The number belongs to the sentence that needs a comparison.
 */
export function corpusRootLine(resolution: CorpusResolution): string {
  if (resolution.root === null) return '';
  return `my_context corpus: ${resolution.root}` +
    `${resolution.overridden ? ` (named by ${CORPUS_DIR_ENV})` : ''}.`;
}

/**
 * The loud one: this is a NESTED corpus and there is another above it.
 *
 * Every clause here is load-bearing. It names both roots so the reader can see
 * which is which; both counts, because the entire failure was reading "44
 * items" as "a small project" rather than "the wrong project"; the directory
 * that ended the walk, because that is the thing the reader actually controls;
 * and both ways to change it. It ends by saying nothing was blocked or
 * overridden, so a reader who MEANT the nested corpus can stop reading.
 */
export function nestedCorpusNote(resolution: CorpusResolution): string {
  const { root, nesting } = resolution;
  if (root === null || nesting === null) return '';
  return [
    'my_context: WRONG CORPUS? This resolved to a NESTED corpus, and there is another one ' +
    'higher up the same tree.',
    `  used      ${root} — ${countPhrase(nesting.items)}`,
    `  enclosing ${nesting.enclosing} — ${countPhrase(nesting.enclosingItems)}`,
    'The corpus is found by walking up from the working directory and stopping at the first ' +
    `\`${DIR_NAME}\`, so the directory this ran in decided which one it got: ` +
    `${path.dirname(root)} holds its own, and the walk stopped there. Read the smaller number ` +
    'as A DIFFERENT CORPUS, not as a project with little recorded in it.',
    'Nothing was blocked and nothing was overridden. If the nested corpus is the one you ' +
    `meant, ignore this. If it is not, run from ${path.dirname(nesting.enclosing)} or set ` +
    `${CORPUS_DIR_ENV}=${nesting.enclosing}.`,
  ].join('\n');
}
